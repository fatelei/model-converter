import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true});
try{
 const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5180');
 await p.locator('#file').setInputFiles('../单色打印版.3mf');await p.locator('#target').selectOption('stl');await p.locator('#convert').click();
 await p.locator('#download').waitFor({state:'visible',timeout:300000});assert.match(await p.locator('#status').textContent(),/1,866,956/);
 const pending=p.waitForEvent('download');await p.locator('#download').click();await(await pending).saveAs('/private/tmp/large-browser-model.stl');assert.deepEqual(errors,[]);
 console.log('PASS: 单色打印版.3mf → STL, 1,866,956 triangles, background worker and download');
}finally{await b.close();}
