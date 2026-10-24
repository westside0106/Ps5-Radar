import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.RADAR_TEST_URL||'http://127.0.0.1:3100';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [375,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE'});
  const page=await context.newPage();
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.title()!==undefined);
  // Private API requests must never return private data before authentication.
  for(const endpoint of ['/mein-playstation/api/trophies?id=NPWR00001_00','/mein-playstation/api/digital-library','/mein-playstation/api/extra-sources?title=Test%20Game']){
   const r=await context.request.get(base+endpoint,{maxRedirects:0});
   assert.ok([401,302,303,307,308].includes(r.status()),endpoint+' unexpectedly available: '+r.status());
  }
  const input=page.locator('input[name="password"]');
  if(await input.count()){
   await input.fill(process.env.RADAR_PASSWORD||'radar-local');
   await page.getByRole('button',{name:'Radar öffnen'}).click();
   await page.waitForURL('**/radar');
   await page.locator('.magazine').waitFor();
   await page.goto(base+'/mein-playstation',{waitUntil:'domcontentloaded'});
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.client+2,'Horizontal overflow at '+width+': '+JSON.stringify(size));
  }
  await context.close();
 }
 console.log('PSN private endpoint and responsive mobile browser smoke checks passed');
}finally{await browser.close()}
