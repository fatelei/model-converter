import {OcctKernel} from 'occt-wasm';
import wasmUrl from 'occt-wasm/dist/occt-wasm.wasm?url';
import {convertWithKernel} from './step-prototype-core.js';
self.onmessage=async({data})=>{
 let k;try{
  const start=performance.now();self.postMessage({phase:'加载 CAD 内核…'});
  k=await OcctKernel.init({wasm:wasmUrl});const initMs=Math.round(performance.now()-start);
  self.postMessage({phase:'正在转换并校验…'});
  const result=await convertWithKernel(k,data);result.metrics.initMs=initMs;self.postMessage({result});
 }catch(e){self.postMessage({error:e.message||String(e)});}finally{k?.[Symbol.dispose]();}
};
