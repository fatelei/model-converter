import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');
 await page.locator('#file').setInputFiles('/private/tmp/converter-box.stl');await page.locator('#key').fill('local-test');await page.locator('#convert').click();
 await page.locator('#download').waitFor({state:'visible',timeout:90000});assert.match(await page.locator('#status').textContent(),/实体回读校验通过/);
 const d=page.waitForEvent('download');await page.locator('#download').click();await(await d).saveAs('/private/tmp/api-box.step');
 await page.locator('#file').setInputFiles('/private/tmp/api-box.step');await page.locator('#target').selectOption('3mf');await page.locator('#convert').click();await page.locator('#download').waitFor({state:'visible',timeout:90000});
 console.log('PASS: upload → async status → validated STEP download → STEP to 3MF');
}finally{await browser.close();}
