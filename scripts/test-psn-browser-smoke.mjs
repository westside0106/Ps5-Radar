import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base=process.env.RADAR_TEST_URL||'http://localhost:3100';
for(const [engine,widths] of [[chromium,[375,390,430,768,1280]],[webkit,[375,390,430]]]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',isMobile:width<=430,hasTouch:width<=430,deviceScaleFactor:width<=430?2:1});
  const page=await context.newPage();
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.title()!==undefined);
  // Private API requests must never return private data before authentication.
  for(const endpoint of ['/mein-playstation/api/trophies?id=NPWR00001_00','/mein-playstation/api/digital-library','/mein-playstation/api/profile-sync','/mein-playstation/api/extra-sources?title=Test%20Game']){
   const r=await context.request.get(base+endpoint,{maxRedirects:0});
   assert.ok([401,302,303,307,308].includes(r.status()),endpoint+' unexpectedly available: '+r.status());
  }
  const unauthorizedUpload=await context.request.put(base+'/mein-playstation/api/profile-sync',{data:{version:2,revision:0,data:{notes:{},history:[]}},maxRedirects:0});
  assert.ok([401,302,303,307,308].includes(unauthorizedUpload.status()),'Cloud endpoint must reject unauthenticated writes');
  const input=page.locator('input[name="password"]');
  if(await input.count()){
   await input.fill(process.env.RADAR_PASSWORD||'radar-local');
   await page.getByRole('button',{name:'Radar öffnen'}).click();
   await page.waitForURL('**/radar');
   await page.locator('.magazine').waitFor();
   await page.goto(base+'/mein-playstation?view=games',{waitUntil:'domcontentloaded'});
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.client+2,engine.name()+' horizontal overflow at '+width+': '+JSON.stringify(size));
   // Live PSN data is not available in CI; exercise the real cards whenever fixture data is present.
   const gameCard=page.locator('.psn-hub-game').first();
   if(await gameCard.count()){
    await gameCard.click();
    const dialog=page.getByRole('dialog',{name:/Spieldetails/i});
    await dialog.waitFor();
    const modalSize=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    assert.ok(modalSize.width<=modalSize.viewport+1&&modalSize.scrollWidth<=modalSize.clientWidth+2,engine.name()+' modal horizontal overflow: '+JSON.stringify(modalSize));
    await dialog.getByRole('button',{name:'Schließen'}).click();
    assert.equal(await dialog.count(),0);
   }

  }
  await context.close();
 }
 }finally{await browser.close()}
}
console.log('PSN private routes, responsive Chromium and touch-enabled WebKit browser smoke checks passed');
