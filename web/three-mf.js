import {SaxesParser} from 'saxes';
import {readModelArchive} from './model-archive.js';
import {Group,Mesh,BufferGeometry,Float32BufferAttribute,BufferAttribute,Matrix4} from 'three';
export const MAX_TRIANGLES=3000000;
const units={micron:.001,millimeter:1,centimeter:10,meter:1000,inch:25.4,foot:304.8};
const production='http://schemas.microsoft.com/3dmanufacturing/production/2015/06';
function parse(bytes){
 const parser=new SaxesParser({xmlns:true}),doc={objects:new Map(),build:[],rels:[],unit:'millimeter'};let object=null,mesh=false;
 parser.on('doctype',()=>{throw Error('不支持 XML 实体声明');});
 parser.on('opentag',tag=>{
  const a={};for(const attr of Object.values(tag.attributes)){if(!attr.uri)a[attr.local]=attr.value;else if(attr.uri===production)a['p:'+attr.local]=attr.value;}
  switch(tag.local){
   case 'model':doc.unit=a.unit||'millimeter';break;
   case 'Relationship':doc.rels.push(a);break;
   case 'object':object={id:a.id,vertices:[],faces:[],components:[]};doc.objects.set(a.id,object);break;
   case 'mesh':mesh=true;break;
   case 'vertex':if(object&&mesh){for(const k of ['x','y','z']){if(a[k]===undefined||!Number.isFinite(Number(a[k])))throw Error(`零件 ${object.id} 包含无效顶点坐标`);object.vertices.push(Number(a[k]));}}break;
   case 'triangle':if(object&&mesh){if(object.faces.length/3>=MAX_TRIANGLES)throw Error('单个零件超过 3,000,000 三角面，请拆分模型');for(const k of ['v1','v2','v3']){if(a[k]===undefined||!Number.isSafeInteger(Number(a[k]))||Number(a[k])<0)throw Error(`零件 ${object.id} 包含无效三角面索引`);object.faces.push(Number(a[k]));}}break;
   case 'component':if(object)object.components.push(a);break;
   case 'item':doc.build.push(a);break;
  }
 });
 parser.on('closetag',tag=>{if(tag.local==='mesh')mesh=false;if(tag.local==='object'){
  object.vertices=new Float32Array(object.vertices);object.faces=new Uint32Array(object.faces);object=null;
 }});
 const decoder=new TextDecoder();for(let i=0;i<bytes.length;i+=65536)parser.write(decoder.decode(bytes.subarray(i,i+65536),{stream:true}));parser.write(decoder.decode()).close();return doc;
}
export function read3mf(buffer){
 const files=readModelArchive(buffer),docs=new Map(),root=new Group();let triangles=0;
 function model(path){if(!docs.has(path)){if(!files[path])throw Error('3MF 缺少组件文件：'+path);const d=parse(files[path]);delete files[path];d.u=units[d.unit];if(!d.u)throw Error('不支持的单位');docs.set(path,d);}return docs.get(path);}
 function matrix(a,u){if(!a.transform)return new Matrix4();const v=a.transform.trim().split(/\s+/).map(Number);if(v.length!==12||!v.every(Number.isFinite))throw Error('无效组件变换');return new Matrix4().set(v[0],v[3],v[6],v[9]*u,v[1],v[4],v[7],v[10]*u,v[2],v[5],v[8],v[11]*u,0,0,0,1);}
 function visit(path,id,t,stack=[]){
  const key=path+'#'+id;if(stack.includes(key)||stack.length>32)throw Error('组件循环或嵌套过深');
  const {u,objects}=model(path),obj=objects.get(id);if(!obj)throw Error('找不到 3MF 零件：'+id);
  for(const c of obj.components){
   const ref=c['p:path'];let dest=path;
   if(ref){const pieces=(ref.startsWith('/')?ref:path.slice(0,path.lastIndexOf('/')+1)+ref).split('/'),normalized=[];for(const x of pieces){if(x==='..')normalized.pop();else if(x&&x!=='.')normalized.push(x);}dest=normalized.join('/');}
   visit(dest,c.objectid,t.clone().multiply(matrix(c,u)),[...stack,key]);
  }
  if(!obj.faces.length)return;
  const vs=obj.vertices,fs=obj.faces;triangles+=fs.length/3;
  if(triangles>MAX_TRIANGLES)throw Error(`模型实例合计 ${triangles.toLocaleString('en-US')} 个三角面，超过 3,000,000 上限，请拆分模型`);
  if(!vs.every(Number.isFinite))throw Error(`零件 ${id} 顶点坐标超出可表示范围`);
  if(!fs.every(i=>i<vs.length/3))throw Error(`零件 ${id} 的三角面引用了不存在的顶点`);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vs,3));g.setIndex(new BufferAttribute(fs,1));g.scale(u,u,u);g.applyMatrix4(t);root.add(new Mesh(g));
 }
 let path='3D/3dmodel.model';if(files['_rels/.rels'])for(const r of parse(files['_rels/.rels']).rels)if(r.Type?.endsWith('/3dmodel'))path=r.Target.replace(/^\//,'');
 const d=model(path);for(const item of d.build)visit(path,item.objectid,matrix(item,d.u));return root;
}
