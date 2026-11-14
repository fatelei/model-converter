const $=id=>document.getElementById(id);let worker,timer,blobUrl;
function stop(){worker?.terminate();clearTimeout(timer);$('run').disabled=false;$('cancel').disabled=true;}
$('cancel').onclick=()=>{stop();$('status').textContent='已取消';};
$('run').onclick=async()=>{
 const file=$('file').files[0];if(!file)return;
 const source=file.name.split('.').pop().toLowerCase().replace('stp','step'),target=$('target').value;
 if(file.size>20*1024**2){$('status').textContent='原型输入暂限 20 MB';return;}
 stop();if(blobUrl)URL.revokeObjectURL(blobUrl);$('download').hidden=true;$('run').disabled=true;$('cancel').disabled=false;
 worker=new Worker(new URL('./step-prototype-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{if(data.phase){$('status').textContent=data.phase;return;}stop();if(data.error){$('status').textContent=data.error;return;}window.lastMetrics=data.result.metrics;$('status').textContent=JSON.stringify(data.result.metrics,null,2);blobUrl=URL.createObjectURL(data.result.blob);$('download').href=blobUrl;$('download').download=file.name.replace(/\.[^.]+$/,'')+'.'+target;$('download').hidden=false;};
 worker.onerror=e=>{stop();$('status').textContent=e.message||'CAD 内核加载失败';};
 timer=setTimeout(()=>{stop();$('status').textContent='超过 120 秒，已终止';},120000);
 const buffer=await file.arrayBuffer();worker.postMessage({buffer,source,target},[buffer]);
};
