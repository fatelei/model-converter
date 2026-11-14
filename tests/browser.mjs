import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173');
 await page.locator('#file').setInputFiles('../坐姿矫正(单色版).3mf');await page.locator('#target').selectOption('stl');await page.locator('#convert').click();
 await page.locator('#download').waitFor({state:'visible'});assert.ok((await page.locator('#status').textContent()).includes(Number(process.env.EXPECTED_TRIANGLES || 86232).toLocaleString('en-US')));
 const download=page.waitForEvent('download');await page.locator('#download').click();await(await download).saveAs('/private/tmp/browser-model.stl');
 await page.locator('#file').setInputFiles('/private/tmp/browser-model.stl');await page.locator('#target').selectOption('3mf');await page.locator('#convert').click();await page.locator('#download').waitFor({state:'visible'});
 const download2=page.waitForEvent('download');await page.locator('#download').click();await(await download2).saveAs('/private/tmp/browser-model.3mf');
 await page.screenshot({path:'/private/tmp/model-converter-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/model-converter-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: real 3MF → STL, STL → 3MF, downloads, responsive layout, no browser errors');
}finally{await browser.close();}
