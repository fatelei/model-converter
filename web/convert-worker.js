import {localConvert} from './local.js';
self.onmessage=({data})=>{try{self.postMessage({result:localConvert(data.buffer,data.source,data.target,data.unit)});}catch(e){self.postMessage({error:e.message||'模型转换失败'});}};
