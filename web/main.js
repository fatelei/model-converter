async function localConvert(buffer,source,target,unit){
 const worker=new Worker(new URL('./convert-worker.js',import.meta.url),{type:'module'});
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{worker.terminate();reject(Error('转换超过 5 分钟，请拆分模型后重试'));},300000);
  const finish=()=>{clearTimeout(timer);worker.terminate();};
  worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.result);};
  worker.onerror=()=>{finish();reject(Error('转换线程异常，可能内存不足；请拆分模型或使用桌面浏览器'));};
  worker.postMessage({buffer,source,target,unit},[buffer]);
 });
}
const $=id=>document.getElementById(id);let file,source,busy=false,result;
const freeMode=import.meta.env.MODE==='free';
if(freeMode){$('filemeta').textContent='点击选择 · 3MF ≤ 50 MB / STL ≤ 200 MB';document.querySelector('.formats').innerHTML='<span>STL</span><i>↔</i><span>3MF</span>';$('key-label').hidden=true;$('file').accept='.3mf,.stl';document.querySelector('.tag').textContent='免费版 · 文件不上传';document.querySelector('.eyebrow').textContent='3MF ↔ STL · 浏览器本地转换';document.querySelector('.footnote').textContent='文件仅在浏览器处理 · 输出毫米 · 最多 300 万三角面';document.querySelector('.note').innerHTML='<b>免费版已启用</b><p>仅支持 STL 与 3MF 互转。</p>';$('target').querySelector('[value=step]').remove();document.querySelector('.drop small').textContent='支持 .3mf / .stl';}
const scale={millimeter:1,centimeter:10,meter:1000,inch:25.4};
function message(text,error=false){$('status').hidden=false;$('status').className=error?'error':'';$('status').textContent=text;}
function sync(){
 const target=$('target').value;const local=source&&source!=='step'&&target!=='step';
 $('unit').disabled=source!=='stl'||busy;$('precision-label').hidden=source!=='step';$('key-label').hidden=freeMode||local;
 $('hint').textContent=!source?'选择一个模型文件开始。':local?'本地转换：文件留在浏览器中，输出单位为毫米。':target==='step'?'将检查闭合性、合并共面面片并校验实体。无法修复的网格会报告错误。':'将曲面转换为三角网格，精度越高，文件越大。';
 $('convert').disabled=!file||busy;$('target').disabled=busy;$('file').disabled=busy;
}
function select(f){
 if(busy||!f)return;
 const ext=f.name.split('.').pop().toLowerCase();source=ext==='stp'?'step':ext;
 const allowed=freeMode?['3mf','stl']:['3mf','stl','step'];
 const limitMB=freeMode&&source==='stl'?200:50;
 let error='';
 if(!allowed.includes(source))error=freeMode?'仅支持 STL 与 3MF 互转，请选择 .stl 或 .3mf 文件。':'请选择 3MF、STL 或 STEP 文件。';
 else if(!f.size)error='文件为空，请重新选择。';
 else if(f.size>limitMB*1024**2)error=`${source.toUpperCase()} 文件为 ${(f.size/1024**2).toFixed(2)} MB，超过 ${limitMB} MB 上限。`;
 if(error){file=null;source=null;result=null;$('download').hidden=true;message(error,true);sync();return;}
 file=f;result=null;$('download').hidden=true;$('status').hidden=true;$('filename').textContent=f.name;$('filemeta').textContent=`${(f.size/1024**2).toFixed(2)} MB · ${source.toUpperCase()}`;
 for(const option of $('target').options)option.disabled=option.value===source;
 if($('target').value===source)$('target').value=freeMode?(source==='3mf'?'stl':'3mf'):(source==='step'?'stl':'step');sync();
}
$('file').onchange=e=>select(e.target.files[0]);$('target').onchange=()=>{result=null;$('download').hidden=true;sync();};
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('drag');};$('drop').ondragleave=()=>$('drop').classList.remove('drag');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');select(e.dataTransfer.files[0]);};
async function api(path,options={}){
 const res=await fetch(path,{...options,headers:{...options.headers,Authorization:`Bearer ${$('key').value}`}});
 if(!res.ok){const err=await res.json().catch(()=>({error:`服务返回 ${res.status}`}));throw Error(err.error||'请求失败');}return res;
}
$('form').onsubmit=async e=>{
 e.preventDefault();if(!file||busy)return;
 busy=true;result=null;$('download').hidden=true;sync();const target=$('target').value;if(freeMode&&(source==='step'||target==='step')){busy=false;sync();return;}const name=file.name.replace(/\.[^.]+$/,'')+'.'+target;
 try{
  if(source!=='step'&&target!=='step'){
   message('正在本地转换…');await new Promise(r=>setTimeout(r,50));
   const out=await localConvert(await file.arrayBuffer(),source,target,scale[$('unit').value]);result={blob:out.blob,name};message(`转换完成 · ${out.parts} 个网格 · ${out.triangles.toLocaleString()} 个三角面 · 毫米`);
  }else{
   if(!$('key').value)throw Error('请输入服务访问口令');
   message('正在上传并启动 CAD 服务，首次启动可能需要一些时间…');
   const q=new URLSearchParams({source,target,unit:$('unit').value,tolerance:$('precision').value});
   const job=await (await api('/api/jobs?'+q,{method:'POST',body:file})).json();let state;const start=Date.now();
   do{
    await new Promise(r=>setTimeout(r,2500));state=await (await api('/api/jobs/'+job.id)).json();
    message(`CAD 转换处理中 · 已等待 ${Math.round((Date.now()-start)/1000)} 秒`);
    if(Date.now()-start>540000)throw Error('等待超时，请稍后重试');
   }while(state.status==='processing');
   if(state.status!=='done')throw Error(state.error||'转换失败');
   result={url:'/api/jobs/'+job.id+'/download',name};message(`转换完成 · ${state.parts} 个零件 · ${state.validatedSolid?'STEP 实体回读校验通过':'三角网格'} · 毫米`);
  }
  $('download').hidden=false;
 }catch(err){message(err.message,true);}finally{busy=false;sync();}
};
$('download').onclick=async()=>{
 if(!result)return;$('download').disabled=true;
 try{const blob=result.blob||await(await api(result.url)).blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=result.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(err){message(err.message,true);}finally{$('download').disabled=false;}
};sync();
