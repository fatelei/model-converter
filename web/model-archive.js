import {unzipSync} from 'fflate';
export const MAX_MODEL_BYTES=300*1024**2;
export function modelEntryFilter(){
 let bytes=0,entries=0;
 return file=>{
  if(++entries>10000)throw Error('3MF 文件条目过多（最多 10,000 个）');
  const needed=file.name.endsWith('.model')||file.name==='_rels/.rels';
  if(!needed)return false;
  if(!Number.isSafeInteger(file.originalSize)||file.originalSize<0)throw Error('3MF 文件大小信息无效');
  bytes+=file.originalSize;
  if(bytes>MAX_MODEL_BYTES)throw Error('3MF 模型数据解压后超过 300 MB，请拆分模型后再转换');
  return true;
 };
}
export function readModelArchive(buffer){
 const input=new Uint8Array(buffer),check=modelEntryFilter();
 // Validate every selected entry before allocating any decompressed buffers.
 unzipSync(input,{filter:file=>{check(file);return false;}});
 return unzipSync(input,{filter:modelEntryFilter()});
}
