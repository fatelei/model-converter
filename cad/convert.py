import sys, json, zipfile, posixpath, io
from pathlib import Path
import numpy as np
import trimesh
from defusedxml import ElementTree as ET

MAX_FACES = 200000
UNITS = {'micron':.001,'millimeter':1.,'centimeter':10.,'meter':1000.,'inch':25.4,'foot':304.8}
NS = {'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
P = '{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}'

def matrix(value):
    a=np.eye(4)
    if value:
        values=np.array([float(x) for x in value.split()])
        if values.size != 12 or not np.isfinite(values).all(): raise ValueError('无效的组件变换')
        a[:3,:]=values.reshape(4,3).T
    return a

def check_mesh(mesh):
    if not len(mesh.faces) or not np.isfinite(mesh.vertices).all(): raise ValueError('网格为空或坐标无效')
    if len(mesh.faces)>MAX_FACES: raise ValueError('模型三角面超过 200,000 上限')
    return mesh

def read_3mf(path):
    meshes=[]
    with zipfile.ZipFile(path) as z:
        if len(z.infolist())>2000 or sum(i.file_size for i in z.infolist())>150*1024**2: raise ValueError('3MF 解压后过大')
        cache={}; total=0
        def model(path):
            if path not in cache:
                root=ET.fromstring(z.read(path)); unit=UNITS.get(root.get('unit','millimeter'))
                if unit is None: raise ValueError('不支持的 3MF 单位')
                cache[path]=(root,{o.get('id'):o for o in root.findall('m:resources/m:object',NS)},unit)
            return cache[path]
        rootpath='3D/3dmodel.model'
        if '_rels/.rels' in z.namelist():
            for rel in ET.fromstring(z.read('_rels/.rels')):
                if rel.get('Type','').endswith('/3dmodel'): rootpath=rel.get('Target').lstrip('/')
        root,objects,unit=model(rootpath)
        def visit(path,oid,transform,stack):
            nonlocal total
            key=(path,oid)
            if key in stack or len(stack)>32: raise ValueError('3MF 组件循环或嵌套过深')
            _,objects,unit=model(path); obj=objects[oid]
            for comp in obj.findall('m:components/m:component',NS):
                dest=comp.get(P+'path',path)
                if comp.get(P+'path'): dest=dest.lstrip('/') if dest.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(path),dest))
                ct=matrix(comp.get('transform')); ct[:3,3]*=unit
                visit(dest,comp.get('objectid'),transform@ct,stack+[key])
            mesh=obj.find('m:mesh',NS)
            if mesh is not None:
                verts=np.array([[float(v.get(k)) for k in ('x','y','z')] for v in mesh.findall('m:vertices/m:vertex',NS)])*unit
                faces=np.array([[int(t.get(k)) for k in ('v1','v2','v3')] for t in mesh.findall('m:triangles/m:triangle',NS)])
                total+=len(faces)
                if total>MAX_FACES: raise ValueError('模型三角面超过 200,000 上限')
                if faces.size==0 or faces.min()<0 or faces.max()>=len(verts): raise ValueError('无效的网格索引')
                m=trimesh.Trimesh(verts,faces,process=True); m.apply_transform(transform)
                meshes.append(check_mesh(m))
        for item in root.findall('m:build/m:item',NS):
            t=matrix(item.get('transform'));t[:3,3]*=unit
            visit(rootpath,item.get('objectid'),t,[])
    if not meshes: raise ValueError('3MF 没有可转换零件')
    return meshes

def read_meshes(path,fmt,unit):
    if fmt=='3mf': return read_3mf(path)
    mesh=trimesh.load(path,file_type='stl',force='mesh',process=True)
    mesh.apply_scale(UNITS[unit]);check_mesh(mesh)
    return list(mesh.split(only_watertight=False, repair=False))

def write_3mf(meshes,path):
    from xml.etree.ElementTree import Element, SubElement, tostring
    n=NS['m'];root=Element('model',{'unit':'millimeter','xmlns':n});res=SubElement(root,'resources');build=SubElement(root,'build')
    for idx,m in enumerate(meshes,1):
        obj=SubElement(res,'object',{'id':str(idx),'type':'model'}); mesh=SubElement(obj,'mesh');verts=SubElement(mesh,'vertices');faces=SubElement(mesh,'triangles')
        for v in m.vertices: SubElement(verts,'vertex',dict(zip(('x','y','z'),map(str,v))))
        for f in m.faces: SubElement(faces,'triangle',dict(zip(('v1','v2','v3'),map(str,f))))
        SubElement(build,'item',{'objectid':str(idx)})
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('3D/3dmodel.model',tostring(root,encoding='utf-8',xml_declaration=True))
        z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')

def read_step(path):
    from OCP.STEPControl import STEPControl_Reader
    from OCP.IFSelect import IFSelect_RetDone
    r=STEPControl_Reader()
    if r.ReadFile(str(path))!=IFSelect_RetDone or not r.TransferRoots(): raise ValueError('无法读取 STEP 几何')
    return r.OneShape()

def shapes(shape,kind):
    from OCP.TopExp import TopExp_Explorer
    e=TopExp_Explorer(shape,kind)
    while e.More(): yield e.Current(); e.Next()

def step_meshes(path,tolerance):
    from OCP.BRepMesh import BRepMesh_IncrementalMesh
    from OCP.BRep import BRep_Tool
    from OCP.TopAbs import TopAbs_FACE,TopAbs_SOLID,TopAbs_REVERSED
    from OCP.TopoDS import TopoDS
    from OCP.TopLoc import TopLoc_Location
    shape=read_step(path); tess=BRepMesh_IncrementalMesh(shape,tolerance,False,.3,False)
    if not tess.IsDone(): raise ValueError('STEP 网格化失败')
    solids=list(shapes(shape,TopAbs_SOLID)) or [shape]; result=[];total=0
    for solid in solids:
        vs=[];fs=[]
        for face in shapes(solid,TopAbs_FACE):
            loc=TopLoc_Location();tri=BRep_Tool.Triangulation_s(TopoDS.Face(face),loc)
            if tri is None: continue
            offset=len(vs)
            for i in range(1,tri.NbNodes()+1):
                p=tri.Node(i).Transformed(loc.Transformation());vs.append([p.X(),p.Y(),p.Z()])
            for i in range(1,tri.NbTriangles()+1):
                a,b,c=tri.Triangle(i).Get()
                if face.Orientation()==TopAbs_REVERSED: b,c=c,b
                fs.append([offset+a-1,offset+b-1,offset+c-1])
                total+=1
                if total>MAX_FACES: raise ValueError('输出超过 200,000 面，请降低精度')
        if fs: result.append(check_mesh(trimesh.Trimesh(vs,fs,process=True)))
    if not result: raise ValueError('STEP 没有可转换曲面')
    return result

def meshes_step(meshes,path):
    from OCP.gp import gp_Pnt
    from OCP.BRepBuilderAPI import BRepBuilderAPI_MakePolygon,BRepBuilderAPI_MakeFace,BRepBuilderAPI_Sewing,BRepBuilderAPI_MakeSolid
    from OCP.BRepCheck import BRepCheck_Analyzer
    from OCP.BRepLib import BRepLib
    from OCP.ShapeUpgrade import ShapeUpgrade_UnifySameDomain
    from OCP.TopAbs import TopAbs_SHELL,TopAbs_SOLID
    from OCP.TopoDS import TopoDS,TopoDS_Compound
    from OCP.BRep import BRep_Builder
    from OCP.STEPControl import STEPControl_Writer,STEPControl_AsIs
    from OCP.IFSelect import IFSelect_RetDone
    builder=BRep_Builder(); compound=TopoDS_Compound();builder.MakeCompound(compound);count=0
    for m in meshes:
        if not m.is_watertight: raise ValueError("网格不闭合，无法生成可靠实体；请先修复开放边")
        for part in m.split(only_watertight=False, repair=False):
            if not part.is_watertight: raise ValueError('网格不闭合，无法生成可靠实体；请先修复开放边')
            part.fix_normals()
            if not part.is_volume: raise ValueError('网格方向或体积无效')
            sew=BRepBuilderAPI_Sewing(1e-6)
            for tri in part.triangles:
                poly=BRepBuilderAPI_MakePolygon()
                for v in tri: poly.Add(gp_Pnt(*map(float,v)))
                poly.Close(); face=BRepBuilderAPI_MakeFace(poly.Wire())
                if not face.IsDone(): raise ValueError('存在退化三角面')
                sew.Add(face.Face())
            sew.Perform(); shells=list(shapes(sew.SewedShape(),TopAbs_SHELL))
            if len(shells)!=1: raise ValueError('无法将零件缝合为单个封闭壳')
            solid=BRepBuilderAPI_MakeSolid(TopoDS.Shell(shells[0])).Solid()
            BRepLib.OrientClosedSolid_s(solid)
            if not BRepCheck_Analyzer(solid).IsValid(): raise ValueError('生成的实体未通过 CAD 校验')
            unify=ShapeUpgrade_UnifySameDomain(solid,True,True,False);unify.Build();optimized=unify.Shape()
            if BRepCheck_Analyzer(optimized).IsValid(): solid=optimized
            builder.Add(compound,solid);count+=1
    writer=STEPControl_Writer();writer.Transfer(compound,STEPControl_AsIs)
    if writer.Write(str(path))!=IFSelect_RetDone: raise ValueError('STEP 写入失败')
    reread=read_step(path)
    if len(list(shapes(reread,TopAbs_SOLID)))!=count or not BRepCheck_Analyzer(reread).IsValid(): raise ValueError('STEP 回读校验失败')
    return count

def convert(src,fmt,target,out,unit='millimeter',tolerance=.1):
    if fmt not in ('3mf','stl','step') or target not in ('3mf','stl','step') or fmt==target: raise ValueError('不支持的转换方向')
    if unit not in UNITS or tolerance not in (.05,.1,.3): raise ValueError('无效的单位或精度')
    meshes=step_meshes(src,tolerance) if fmt=='step' else read_meshes(src,fmt,unit)
    faces=sum(len(m.faces) for m in meshes)
    if faces>MAX_FACES: raise ValueError('超过 200,000 面上限')
    parts=len(meshes)
    if target=='step': parts=meshes_step(meshes,out)
    elif target=='3mf': write_3mf(meshes,out)
    else: trimesh.util.concatenate(meshes).export(out,file_type='stl')
    return {'parts':parts,'triangles':faces,'unit':'mm','validatedSolid':target=='step'}

if __name__=='__main__':
    p=Path(sys.argv[1]);cfg=json.loads((p/'request.json').read_text())
    try:
        meta=convert(p/'input',cfg['source'],cfg['target'],p/('result.'+cfg['target']),cfg['unit'],cfg['tolerance'])
        (p/'done.json').write_text(json.dumps({'status':'done',**meta}))
    except Exception as e:
        (p/'done.json').write_text(json.dumps({'status':'error','error':str(e)[:300]}))
        sys.exit(1)
