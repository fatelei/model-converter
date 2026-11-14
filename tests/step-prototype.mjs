import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const b=await chromium.launch({headless:true});const results=[];
try{
 const p=await b.newPage();const requests=[];p.on('request',r=>requests.push({method:r.method(),url:r.url()}));
 await p.goto('http://127.0.0.1:5182/step-prototype.html');
 for(const [name,source,target] of [['box','step','stl'],['assembly','step','3mf'],['box','stl','step'],['box','3mf','step'],['torus','stl','step'],['torus-medium','stl','step']]){
  await p.locator('#file').setInputFiles(`/private/tmp/model-step-prototype/${name}.${source}`);await p.locator('#target').selectOption(target);await p.locator('#run').click();
  await p.waitForFunction(()=>!document.querySelector('#run').disabled,{},{timeout:125000});
  assert.equal(await p.locator('#download').isVisible(),true,await p.locator('#status').textContent());
  const metrics=await p.evaluate(()=>window.lastMetrics);assert.equal(metrics.valid,true);
  if(name==='box'){assert.ok(Math.abs(metrics.volume-6000)<.001);assert.ok(Math.abs(metrics.bounds.xmax-metrics.bounds.xmin-10)<.001);}
  if(name==='assembly')assert.equal(metrics.solids,2);
  const download=p.waitForEvent('download');await p.locator('#download').click();await(await download).saveAs(`/private/tmp/model-step-prototype/${name}-${source}-out.${target}`);
  results.push({name,...metrics});console.log(JSON.stringify(results.at(-1)));
 }
 await p.locator('#file').setInputFiles('/private/tmp/model-step-prototype/open.stl');await p.locator('#target').selectOption('step');await p.locator('#run').click();await p.waitForFunction(()=>!document.querySelector('#run').disabled);assert.match(await p.locator('#status').textContent(),/不闭合/);
 await p.locator('#file').setInputFiles('/private/tmp/model-step-prototype/torus-over-limit.stl');await p.locator('#run').click();await p.waitForFunction(()=>!document.querySelector('#run').disabled);assert.match(await p.locator('#status').textContent(),/20,000/);
 assert.ok(requests.every(r=>r.method==='GET'&&r.url.startsWith('http://127.0.0.1:5182/')));
 writeFileSync('/private/tmp/model-step-prototype/browser-results.json',JSON.stringify({results,requests,openMeshRejected:true},null,2));console.log('PASS: four STEP conversion directions; box dimensions/volume; two-solid input; torus; open-mesh rejection; only same-origin GET requests');
}finally{await b.close();}
