// Generated analytic geometry only; no user model files are published.
import {OcctKernel} from 'occt-wasm';
import {writeFileSync,mkdirSync} from 'node:fs';
import {localConvert} from '../web/local.js';
const dir='/private/tmp/model-step-prototype';mkdirSync(dir,{recursive:true});
const k=await OcctKernel.init();
try{
 const box=k.makeBox(10,20,30),assembly=k.makeCompound([box,k.translate(k.makeCylinder(5,20),30,0,0)]);
 for(const [name,shape] of [['box',box],['assembly',assembly],['sphere',k.makeSphere(10)]]){
  writeFileSync(`${dir}/${name}.step`,k.exportStep(shape));const stl=k.exportStl(shape,.1);writeFileSync(`${dir}/${name}.stl`,stl);
  const result=localConvert(stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength),'stl','3mf',1);writeFileSync(`${dir}/${name}.3mf`,Buffer.from(await result.blob.arrayBuffer()));
 }
 for(const [name,tolerance] of [['torus',.05],['torus-medium',.015],['torus-over-limit',.005]])writeFileSync(`${dir}/${name}.stl`,k.exportStl(k.makeTorus(20,5),tolerance));
 const stl=k.exportStl(box),open=stl.slice(0,-50);new DataView(open.buffer,open.byteOffset,open.byteLength).setUint32(80,11,true);writeFileSync(`${dir}/open.stl`,open);
}finally{k[Symbol.dispose]();}
