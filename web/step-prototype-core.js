// Experimental only. Not imported by the production application.
import {localConvert} from './local.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
function checkClosedStl(bytes){
 const g=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const p=g.attributes.position;const triangles=p.count/3;
 if(triangles>20000)throw Error(`实验版网格转 STEP 上限 20,000 面；当前 ${triangles}`);
 if(!triangles)throw Error('网格为空');
 const edges=new Map();
 for(let i=0;i<p.count;i+=3){
  const keys=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].join(','));
  if(new Set(keys).size!==3)throw Error('存在退化三角面');
  for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'|'+b:b+'|'+a;const e=edges.get(key)||{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}
 }
 if([...edges.values()].some(e=>e.count!==2||e.direction!==0))throw Error('网格不闭合、非流形或面朝向不一致');
 g.dispose();return triangles;
}
export async function convertWithKernel(k,{buffer,source,target,tolerance=.1}){
 const started=performance.now();let shape,output,triangles;
 if(source==='step'){
  if(target!=='stl'&&target!=='3mf')throw Error('STEP 只能导出 STL / 3MF');
  shape=k.importStep(buffer);
  if(!k.isValid(shape))throw Error('输入 STEP 未通过几何校验');
  const stl=k.exportStl(shape,tolerance);
  triangles=new DataView(stl.buffer,stl.byteOffset,stl.byteLength).getUint32(80,true);
  if(triangles>3000000)throw Error('输出超过 300 万面');
  output=target==='stl'?new Blob([stl]):localConvert(stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength),'stl','3mf',1).blob;
 }else{
  if(target!=='step')throw Error('该实验只验证 STEP 转换');
  const bytes=source==='3mf'?new Uint8Array(await localConvert(buffer,'3mf','stl',1).blob.arrayBuffer()):new Uint8Array(buffer);
  triangles=checkClosedStl(bytes);
  const mesh=k.importStl(bytes);shape=k.sewAndSolidify(k.getSubShapes(mesh,'face'));
  if(!k.isValid(shape)||k.subShapeCount(shape,'solid')<1||k.getVolume(shape)<=0)throw Error('未能建立有效的正体积实体');
  const unified=k.unifySameDomain(shape);if(k.isValid(unified)&&k.subShapeCount(unified,'solid')>0)shape=unified;
  const step=k.exportStep(shape);const back=k.importStep(step);
  if(!k.isValid(back)||k.subShapeCount(back,'solid')!==k.subShapeCount(shape,'solid'))throw Error('STEP 回读校验失败');
  output=new Blob([step]);
 }
 return {blob:output,metrics:{source,target,triangles,outputBytes:output.size,convertMs:Math.round(performance.now()-started),solids:k.subShapeCount(shape,'solid'),valid:k.isValid(shape),bounds:k.getBoundingBox(shape),volume:k.getVolume(shape),wasmMemoryBytes:k.getRawModule().HEAPU32.buffer.byteLength}};
}
