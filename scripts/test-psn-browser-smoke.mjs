import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const QA_FOLDER='artifacts/gameworld-qa';
mkdirSync(QA_FOLDER,{recursive:true});
const qa=[];
async function captureQa(page,engine,width,view){
 const path=QA_FOLDER+'/'+engine+'-'+width+'-'+view+'.png';
 await page.screenshot({path,animations:'disabled',fullPage:false});
 const metrics=await page.evaluate(()=>{
  const nav=performance.getEntriesByType('navigation').at(-1);
  const paint=performance.getEntriesByType('paint');
  const value=name=>paint.find(x=>x.name===name)?.startTime??null;
  return {domContentLoadedMs:nav?Math.round(nav.domContentLoadedEventEnd):null,
   responseEndMs:nav?Math.round(nav.responseEnd):null,
   loadEventEndMs:nav?Math.round(nav.loadEventEnd):null,
   firstPaintMs:value('first-paint'),firstContentfulPaintMs:value('first-contentful-paint'),
   resourceRequests:performance.getEntriesByType('resource').length,
   domElements:document.querySelectorAll('*').length,
   viewportWidth:document.documentElement.clientWidth,
   documentWidth:document.documentElement.scrollWidth,
   reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches
  };
 });
 qa.push({engine,width,view,path,...metrics});
 writeFileSync(QA_FOLDER+'/measurements.json',JSON.stringify({source:'CI synthetic profile, no real Sony tokens',measurementType:'Browser performance entries; not lab-certified Web Vitals',results:qa},null,2));
}
const base=process.env.RADAR_TEST_URL||'http://localhost:3100';
for(const [engine,widths] of [[chromium,[320,375,390,430,768,1280]],[webkit,[320,375,390,430]]]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',isMobile:false,hasTouch:engine===webkit&&width<=430,deviceScaleFactor:width<=430?2:1,reducedMotion:width===320?'reduce':'no-preference'});
  const page=await context.newPage();
  const clientErrors=[];
  page.on('pageerror',error=>clientErrors.push(String(error?.stack||error?.message||error)));
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
  // WebKit rejects Secure cookies over HTTP localhost in production mode.
  // Inject only a deterministic, CI-only session cookie for WebKit's private-layout check.
  if(engine===webkit){
   const password=process.env.RADAR_PASSWORD||'radar-local';
   const secret=process.env.RADAR_SESSION_SECRET;
   assert.ok(secret,'CI session secret missing');
   const value=createHmac('sha256',secret).update('psradar:'+password).digest('hex');
   await context.addCookies([{name:'psradar_session',value,url:base,httpOnly:true,sameSite:'Lax',secure:false}]);
   await page.goto(base+'/mein-playstation?view=games',{waitUntil:'domcontentloaded'});
  }else if(await input.count()){
   await input.fill(process.env.RADAR_PASSWORD||'radar-local');
   await page.getByRole('button',{name:'Radar öffnen'}).click();
   await page.waitForURL('**/radar',{waitUntil:'domcontentloaded',timeout:15000});
   await page.locator('.magazine').waitFor();
   await page.goto(base+'/mein-playstation?view=games',{waitUntil:'domcontentloaded'});
  }
  if(await page.locator('.psn-shell').count()){
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.client+2,engine.name()+' horizontal overflow at '+width+': '+JSON.stringify(size));
   console.log('Gameworld viewport verified:',engine.name(),width);
   const hero=page.locator('.psn-cinema-hero-content');
   await hero.waitFor();
   if(width===320){
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true,'320px test must emulate reduced motion');
    const duration=await hero.evaluate(el=>parseFloat(getComputedStyle(el).animationDuration)||0);
    assert.ok(duration<0.01,engine.name()+' reduced-motion reveals must be disabled');
   }
   if(width<=430){
    const navCurrent=page.locator('.radar-global-links a[aria-current="page"]');
    await navCurrent.waitFor();
    const navVisible=await navCurrent.evaluate(el=>{
      const r=el.getBoundingClientRect(),n=el.parentElement.getBoundingClientRect();
      return r.left>=n.left-3&&r.right<=n.right+3;
    });
    assert.ok(navVisible,engine.name()+' active navigation link should be scrolled into view at '+width);
   }

   if(width===390||engine===chromium&&width===1280){
    const routes=['/radar','/xbox','/ps-plus','/preise','/archive','/mein-playstation?view=games'];
    for(const route of routes){
     await page.goto(base+route,{waitUntil:'domcontentloaded'});
     const nav=page.locator('.radar-global-navigation');
     await nav.waitFor();
     const current=nav.locator('a[aria-current="page"]');
     assert.equal(await current.count(),1,engine.name()+' missing current section for '+route);
     const overflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(overflow.scroll<=overflow.client+3,engine.name()+' '+width+' overflow at '+route+': '+JSON.stringify(overflow));
     if(route==='/radar')assert.ok(await page.locator('.magazine').count(),'Daily magazine missing');
     if(route==='/mein-playstation?view=games')assert.ok(await page.locator('.psn-shell').count(),'PSN profile shell missing');
    }
   }

   if(width===390){
    await page.locator('.psn-collection-tools').waitFor();
    const edit=page.locator('.psn-tools-fold').first();
    await edit.locator('summary').click();
    await page.getByPlaceholder('Titel eingeben …').fill('Unplayed CI Test');
    await page.getByRole('button',{name:'Zum Backlog hinzufügen'}).click();
    await page.locator('#psn-game-editor label').filter({hasText:/^Status/}).locator('select').selectOption('platinum');
    await page.locator('#psn-game-editor .psn-save-plan').click();
    await page.locator('#psn-game-editor .psn-save-status').getByText(/Gespeichert/).waitFor();
    const card=page.locator('.psn-hub-game').filter({hasText:'Unplayed CI Test'}).first();
    await card.waitFor();
    assert.match(await card.innerText(),/Manuell vorgemerkt/);
    await page.locator('.psn-collection-manage > summary').click();
    await page.getByPlaceholder('z. B. Assassin’s Creed, Open World …').fill('CI Collection');
    await page.getByRole('button',{name:'Sammlung anlegen'}).click();
    await page.getByRole('button',{name:'Alle Spiele'}).click();
    await card.click();
    const dialog=page.getByRole('dialog',{name:/Spieldetails/i});
    await dialog.locator('.psn-game-modal-collections > summary').click();
    await dialog.getByRole('checkbox',{name:'CI Collection'}).check();
    await dialog.locator('.psn-modal-close').click();
    await page.locator('.psn-collection-selector').getByRole('button',{name:/CI Collection/}).click();
    await card.waitFor();
    await page.getByRole('button',{name:'Liste',exact:true}).click();
    assert.ok(await page.locator('.psn-library-list').count(),'List layout not active');
    await page.getByRole('button',{name:'Regal',exact:true}).click();
    assert.ok(await page.locator('.psn-library-shelf').count(),'Shelf layout not active');
    const librarySize=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(librarySize.scroll<=librarySize.client+3,engine.name()+' collection layout overflow: '+JSON.stringify(librarySize));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.psn-collection-tools').waitFor();
    await page.locator('.psn-collection-selector').getByRole('button',{name:/CI Collection/}).waitFor({timeout:10000});
    await page.locator('.psn-hub-game').filter({hasText:'Unplayed CI Test'}).first().waitFor({timeout:10000});
    await page.locator('.psn-library-shelf').waitFor({timeout:10000});
    await captureQa(page,engine.name(),width,'shelf');
   }
   if(width===390){
    await page.getByRole('button',{name:'Trophäen-Zentrale'}).click();
    const mission=page.locator('.psn-mission-control');
    await mission.waitFor();
    assert.ok(await mission.getByText('Deine Platin-Missionen').count(),'Platin mission heading missing');
    await mission.getByRole('heading',{name:'Unplayed CI Test'}).waitFor({timeout:10000});
    await captureQa(page,engine.name(),width,'trophies');
    const preview=page.locator('.psn-trophy-static-preview');
    await preview.waitFor();
    assert.ok(await preview.getByRole('button',{name:'3D-Trophäe aktivieren'}).count(),'3D must be opt-in to avoid heavy initial WebGL work');
    assert.equal(await page.locator('.psn-collection-stage-model canvas').count(),0,'WebGL scene must not be mounted by default');

    await page.getByRole('button',{name:'Meine Spielwelt'}).click();
    const statsFold=page.locator('.psn-tools-fold').filter({hasText:'Gaming-Chronik & Statistiken'});
    await statsFold.locator('summary').click();
    await page.locator('.psn-chronicle').waitFor();
    await page.getByRole('button',{name:'3 Mon.'}).click();
    assert.equal(await page.getByRole('button',{name:'3 Mon.'}).getAttribute('aria-pressed'),'true');
    const w=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(w.scroll<=w.client+3,engine.name()+' chronology overflow: '+JSON.stringify(w));
   }
   if(width===1280&&engine===chromium){
    const fold=page.locator('.psn-tools-fold').first();
    await fold.locator('summary').click();
    await page.getByPlaceholder('Titel eingeben …').fill('CI Wide Game');
    await page.getByRole('button',{name:'Zum Backlog hinzufügen'}).click();
    await page.locator('.psn-hub-game').filter({hasText:'CI Wide Game'}).first().waitFor();
    await captureQa(page,engine.name(),width,'desktop');
   }
   // Live PSN data is not available in CI; exercise the real cards whenever fixture data is present.
   const gameCard=page.locator('.psn-hub-game').first();
   if(await gameCard.count()){
    await gameCard.click();
    const dialog=page.getByRole('dialog',{name:/Spieldetails/i});
    await dialog.waitFor();
    const modalSize=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    assert.ok(modalSize.width<=modalSize.viewport+1&&modalSize.scrollWidth<=modalSize.clientWidth+2,engine.name()+' modal horizontal overflow: '+JSON.stringify(modalSize));
    await dialog.locator('.psn-modal-close').click();
    assert.equal(await dialog.count(),0);
   }

  }
  const relevantErrors=clientErrors.filter(t=>/PlayStationHub|GamingPlanner|PlatinumMissionControl|GamingChronicle|hydrate|hydration|before initialization|ReferenceError/i.test(t));
  assert.deepEqual(relevantErrors,[],engine.name()+' '+width+' runtime/hydration errors');
  await context.close();
 }
 }finally{await browser.close()}
}
console.log('PSN private routes, responsive Chromium and touch-enabled WebKit browser smoke checks passed');
