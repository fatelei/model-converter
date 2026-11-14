import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true});
try{
 const p=await b.newPage();await p.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5180');
 await p.waitForFunction(()=>document.querySelector('#filemeta').textContent.includes('200 MB'));
 for(const [ext,size,ok] of [['stl',200*1024**2,true],['stl',200*1024**2+1,false],['3mf',50*1024**2,true],['3mf',50*1024**2+1,false],['step',100,false]]){
  await p.evaluate(({ext,size})=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(size)],'boundary.'+ext));const input=document.querySelector('#file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{ext,size});
  assert.equal(await p.locator('#convert').isEnabled(),ok);
  if(!ok)assert.doesNotMatch(await p.locator('#status').textContent(),/STEP/);
 }
 await p.locator('#file').setInputFiles('/private/tmp/large-browser-model.stl');await p.locator('#target').selectOption('3mf');await p.locator('#convert').click();
 await p.locator('#download').waitFor({state:'visible',timeout:300000});assert.match(await p.locator('#status').textContent(),/1,866,956/);
 const d=p.waitForEvent('download');await p.locator('#download').click();await(await d).saveAs('/private/tmp/large-roundtrip.3mf');
 console.log('PASS: independent 200 MB STL / 50 MB 3MF boundaries; actual 93 MB STL → 3MF download');
}finally{await b.close();}
