import {read3mf,MAX_TRIANGLES} from './three-mf.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { Mesh, Group } from 'three';
import { zipSync, strToU8 } from 'fflate';
const MAX=MAX_TRIANGLES;
export function localConvert(buffer,source,target,unit){
 let root;
 if(source==='3mf'){
  root=read3mf(buffer);
 }else{
  const geom=new STLLoader().parse(buffer);geom.scale(unit,unit,unit);root=new Group();root.add(new Mesh(geom));
 }
 root.updateMatrixWorld(true);let triangles=0,parts=0;
 root.traverse(o=>{if(o.isMesh){parts++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
 if(!triangles||triangles>MAX)throw Error(triangles?'模型超过 3,000,000 三角面，请拆分模型':'模型不包含可转换的三角面');
 if(target==='stl')return {blob:new Blob([new STLExporter().parse(root,{binary:true})]),parts,triangles};
 let objects=[],items=[];let id=0;
 root.traverse(o=>{
  if(!o.isMesh)return;id++;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld),p=g.attributes.position,ix=g.index;let vs=[],fs=[];
  // STL repeats shared vertices; deduplicate exact coordinates without rounding.
  const unique=new Map(),remap=new Uint32Array(p.count);
  for(let i=0;i<p.count;i++){
   const xyz=[p.getX(i),p.getY(i),p.getZ(i)];if(!xyz.every(Number.isFinite))throw Error('模型包含无效坐标');
   const key=xyz.join(',');let index=unique.get(key);
   if(index===undefined){index=vs.length;unique.set(key,index);vs.push(`<vertex x="${xyz[0]}" y="${xyz[1]}" z="${xyz[2]}"/>`);}
   remap[i]=index;
  }
  for(let i=0;i<(ix?.count??p.count);i+=3)fs.push(`<triangle v1="${remap[ix?ix.getX(i):i]}" v2="${remap[ix?ix.getX(i+1):i+1]}" v3="${remap[ix?ix.getX(i+2):i+2]}"/>`);
  objects.push(`<object id="${id}" type="model"><mesh><vertices>${vs.join('')}</vertices><triangles>${fs.join('')}</triangles></mesh></object>`);items.push(`<item objectid="${id}"/>`);g.dispose();
 });
 const files={
  '3D/3dmodel.model':strToU8(`<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${objects.join('')}</resources><build>${items.join('')}</build></model>`),
  '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
 };
 return {blob:new Blob([zipSync(files)]),parts,triangles};
}
