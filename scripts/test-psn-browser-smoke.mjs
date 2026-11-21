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
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',isMobile:false,hasTouch:engine===webkit&&width<=430,deviceScaleFactor:width<=430?2:1,reducedMotion:width===320?'reduce':'no-preference',serviceWorkers:'block'});
  const page=await context.newPage();
  const testCloudRules=[];
  await page.route('**/zentrale/api/price-alerts',async route=>{
   const method=route.request().method();
   if(method==='GET')return route.fulfill({json:{configured:true,rules:testCloudRules,events:[]}});
   const body=route.request().postDataJSON()||{};
   if(method==='POST'){
    const row={title:body.title,target_price:body.limit,enabled:true,last_status:'unverified',last_checked_at:null};
    const i=testCloudRules.findIndex(x=>x.title===row.title);
    if(i>=0)testCloudRules[i]=row;else testCloudRules.push(row);
    return route.fulfill({json:{saved:true}});
   }
   if(method==='DELETE'){
    const i=testCloudRules.findIndex(x=>x.title===body.title);
    if(i>=0)testCloudRules.splice(i,1);
    return route.fulfill({json:{deleted:true}});
   }
   if(method==='PUT')return route.fulfill({json:{ok:true,checked:testCloudRules.length,created:0,matched:0}});
   return route.fulfill({json:{read:true}});
  });
  await page.route('**/zentrale/api/source-history',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{
    configured:true,checks:[{source_id:'rawg',run_day:'2026-11-21',checked_at:'2026-11-21T09:00:00Z',status:'healthy',detail:'Probe erfolgreich.'}],
    events:[{id:'rawg:outage:2026-11-20',source_id:'rawg',event:'outage',status:'error',detail:'Zwei problematische Prüfungen.',created_at:'2026-11-21T09:00:00Z',read_at:null}],
    summary:[{source_id:'rawg',total:1,healthy:1,degraded:0,errors:0,last:{checked_at:'2026-11-21T09:00:00Z',status:'healthy'}}]
   }});
   if(route.request().method()==='PATCH')return route.fulfill({json:{ok:true,updated:true}});
   return route.fulfill({status:405});
  });
  const clientErrors=[];
  page.on('pageerror',error=>clientErrors.push(String(error?.stack||error?.message||error)));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.title()!==undefined);
  // Private API requests must never return private data before authentication.
  for(const endpoint of ['/mein-playstation/api/trophies?id=NPWR00001_00','/mein-playstation/api/digital-library','/mein-playstation/api/profile-sync','/mein-playstation/api/monitor-sync','/mein-playstation/api/extra-sources?title=Test%20Game','/zentrale/api/price-alerts','/zentrale/api/source-health','/zentrale/api/source-history','/api/radar/source-health','/api/radar/alerts/check']){
   const r=await context.request.get(base+endpoint,{maxRedirects:0});
   assert.ok([401,302,303,307,308].includes(r.status()),endpoint+' unexpectedly available: '+r.status());
  }
  for(const path of ['/zentrale','/museum','/magazin']){
   const response=await context.request.get(base+path,{maxRedirects:0});
   assert.ok([302,303,307,308].includes(response.status()),'Private experience route exposed: '+path+' -> '+response.status());
  }
  const manifestRequest=await context.request.get(base+'/manifest.webmanifest');
  assert.equal(manifestRequest.status(),200,'PWA manifest missing');
  const manifest=await manifestRequest.json();
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/zentrale');
  const sw=await context.request.get(base+'/radar-sw.js');
  assert.equal(sw.status(),200,'Service worker missing');
  assert.match(await sw.text(),/startsWith\('\/_next\/static\/'\)/);
  const unauthorizedUpload=await context.request.put(base+'/mein-playstation/api/profile-sync',{data:{version:2,revision:0,data:{notes:{},history:[]}},maxRedirects:0});
  assert.ok([401,302,303,307,308].includes(unauthorizedUpload.status()),'Cloud endpoint must reject unauthenticated writes');
  const monitorPush=await context.request.post(base+'/mein-playstation/api/monitor-sync',{data:'Date,Status,Game name\\n',headers:{'Content-Type':'text/csv'},maxRedirects:0});
  assert.equal(monitorPush.status(),401,'Machine upload must reject requests without the separate push token');
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
  const cookieOnlyMonitorPush=await context.request.post(base+'/mein-playstation/api/monitor-sync',{data:'Date,Status,Game name\\n',headers:{'Content-Type':'text/csv'},maxRedirects:0});
  assert.equal(cookieOnlyMonitorPush.status(),401,'Radar login cookie must not grant permission to push monitor data');
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
    const routes=['/radar','/xbox','/ps-plus','/preise','/archive','/zentrale','/museum','/magazin','/mein-playstation?view=games'];
    for(const route of routes){
     await page.goto(base+route,{waitUntil:'domcontentloaded'});
     const nav=page.locator('.radar-global-navigation');
     await nav.waitFor();
     const current=nav.locator('a[aria-current="page"]');
     assert.equal(await current.count(),1,engine.name()+' missing current section for '+route);
     const overflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(overflow.scroll<=overflow.client+3,engine.name()+' '+width+' overflow at '+route+': '+JSON.stringify(overflow));
     if(route==='/archive'||route==='/xbox'){
      const selector=route==='/archive'?'.archive-shell .archive-sort select':'.is-xbox .catalog-filters select';
      const dropdown=page.locator(selector).first();
      await dropdown.waitFor();
      const visible=await dropdown.evaluate(el=>{
       const styles=getComputedStyle(el);
       const rgb=value=>value.match(/\d+/g)?.slice(0,3).map(Number)||[0,0,0];
       const channel=n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4};
       const lum=v=>{const [a,b,c]=rgb(v).map(channel);return .2126*a+.7152*b+.0722*c};
       const text=lum(styles.color),bg=lum(styles.backgroundColor);
       return {ratio:(Math.max(text,bg)+.05)/(Math.min(text,bg)+.05),scheme:styles.colorScheme};
      });
      assert.ok(visible.ratio>=4.5,engine.name()+' unreadable dark '+route+' select '+JSON.stringify(visible));
      assert.match(visible.scheme,/dark/,engine.name()+' '+route+' select must request dark native options');
     }
     if(route==='/zentrale'){
      await page.locator('.rz-page').waitFor();
      await page.getByRole('button',{name:'Suche',exact:true}).click();
      await page.getByPlaceholder('Spiel, Franchise, Magazinmeldung …').fill('Assassin');
      await page.locator('.rz-result').first().waitFor();
      assert.ok(await page.locator('.rz-result').count(),'Universal search empty');
      await page.getByRole('button',{name:'Kalender'}).click();
      await page.locator('.rz-calendar-export button').waitFor();
      assert.equal(await page.locator('.rz-calendar-export button').count(),1,'Calendar ICS export missing');

      await page.locator('.rz-event-list').waitFor();
      await page.getByRole('button',{name:'Quellen'}).click();
      assert.equal(await page.locator('.rz-source').count(),4);
      await page.locator('section[aria-label="Datenquellen-Monitor"] article').first().waitFor();
      assert.equal(await page.locator('section[aria-label="Datenquellen-Monitor"] article').count(),6,'All six health probes must be visible');
      const healthSize=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      assert.ok(healthSize.scroll<=healthSize.client+2,'Health dashboard overflows viewport: '+JSON.stringify(healthSize));
      assert.ok(await page.getByRole('button',{name:'ERNEUT PRÜFEN'}).count(),'Source recheck control missing');
      await page.locator('section[aria-label="Datenquellen-Historie und Meldungen"] .ignored, section[aria-label="Datenquellen-Historie und Meldungen"] button').first().waitFor();
      assert.equal(await page.locator('section[aria-label="Datenquellen-Historie und Meldungen"] [role=listitem]').count(),84,'Six sources should render 14 calendar cells');
      await page.getByRole('button',{name:'Als gelesen markieren'}).click();
      assert.ok(await page.locator('section[aria-label="Datenquellen-Historie und Meldungen"]').getByText('Gelesen').count(),'Acknowledgement not reflected');
      const historySize=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      assert.ok(historySize.scroll<=historySize.client+2,'Source history overflows viewport: '+JSON.stringify(historySize));
      assert.ok(await page.getByRole('button',{name:/App installieren/}).count(),'PWA install help missing');
      await page.getByRole('button',{name:'Preisregeln'}).click();
      await page.locator('.rz-alert-state.is-ready').waitFor();
      await page.locator('.rz-cloud-editor select').selectOption({index:1});
      await page.getByRole('button',{name:'Preisregel speichern'}).click();
      await page.locator('.rz-cloud-rule-list .rz-rule').first().waitFor();
      assert.ok(await page.locator('.rz-cloud-rule-list .rz-rule').count(),'Cloud price rule was not stored');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('.rz-page').waitFor();
      await page.getByRole('button',{name:'Preisregeln'}).click();
      await page.locator('.rz-cloud-rule-list .rz-rule').first().waitFor();
     }
     if(route==='/museum'){
      await page.locator('.exp-museum-grid').waitFor({state:'attached'});
      assert.ok(await page.getByRole('heading',{name:'Dein Sammlungs-Museum'}).count(),'Museum title missing');
     }
     if(route==='/magazin'){
      await page.locator('.exp-magazine-cover').waitFor();
      assert.ok(await page.getByRole('button',{name:/Als PDF drucken/}).count(),'Print magazine action missing');
     }
     if(route==='/preise')assert.ok(await page.locator('.price-analysis').count()>0,'Historical price charts missing');
     if(route==='/zentrale')await captureQa(page,engine.name(),width,'radar-notifications');
     if(route==='/radar')assert.ok(await page.locator('.magazine').count(),'Daily magazine missing');
     if(route==='/mein-playstation?view=games')assert.ok(await page.locator('.psn-shell').count(),'PSN profile shell missing');
     if(route!=='/zentrale'&&route!=='/mein-playstation?view=games')
      await captureQa(page,engine.name(),width,'section-'+route.slice(1).replaceAll('/','-'));

    }
   }

   if(width===390){
    await page.locator('.psn-collection-tools').waitFor();
    const edit=page.locator('.psn-tools-fold').first();
    await edit.locator('summary').click();
    await page.getByPlaceholder('Titel eingeben …').fill('Unplayed CI Test');
    await page.getByRole('button',{name:'Zum Backlog hinzufügen'}).click();
    await page.locator('#psn-game-editor label').filter({hasText:/^Status/}).locator('select').selectOption('platinum');
    await page.getByLabel('Eigenes Zeitziel (Stunden)').fill('12.5');
    await page.getByLabel('Art des Zeitziels').selectOption('platinum');
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
    const label=await page.locator('.psn-hub-library-head').innerText();
    assert.match(label,/1 Spiel(?!e)/,'Use singular German game count');
    assert.match(label,/eigene Einträge/,'Manual-only library must not claim PSN origin');
    const sortContrast=await page.locator('.psn-browser-fields select').evaluate(el=>{
      const style=getComputedStyle(el);
      const component=rgb=>rgb.match(/\d+/g)?.slice(0,3).map(Number)||[0,0,0];
      const toLinear=v=>{const n=v/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4};
      const light=rgb=>{const [r,g,b]=component(rgb).map(toLinear);return .2126*r+.7152*g+.0722*b};
      const a=light(style.color),b=light(style.backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    assert.ok(sortContrast>=4.5,engine.name()+' dark sort select lacks text contrast: '+sortContrast);
    await page.locator('.psn-hub-library-head').scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'shelf');
   }
   if(width===390){
    await page.getByRole('button',{name:'Trophäen-Zentrale'}).click();
    const mission=page.locator('.psn-mission-control');
    await mission.waitFor();
    assert.ok(await mission.getByText('Deine Platin-Missionen').count(),'Platin mission heading missing');
    await mission.getByRole('heading',{name:'Unplayed CI Test'}).waitFor({timeout:10000});
    const heatmap=page.locator('.psn-earned-heatmap');
    await heatmap.waitFor();
    // The heatmap grid is hydrated in a client-side effect after the section mounts.
    // Wait for the real daily buttons rather than asserting during the initial render.
    await heatmap.locator('.psn-earned-day').first().waitFor({state:'attached',timeout:15000});
    assert.ok(await heatmap.locator('.psn-earned-day').count()>80,'True trophy activity heatmap missing');
    await mission.scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'trophies');
    const preview=page.locator('.psn-trophy-static-preview');
    await preview.waitFor();
    assert.ok(await preview.getByRole('button',{name:'3D-Trophäe aktivieren'}).count(),'3D must be opt-in to avoid heavy initial WebGL work');
    assert.equal(await page.locator('.psn-collection-stage-model canvas').count(),0,'WebGL scene must not be mounted by default');

    await page.getByRole('button',{name:'Meine Spielwelt'}).click();
    const commandDeck=page.getByRole('region',{name:'PlayStation Radar Mission Control'});
    await commandDeck.waitFor();
    assert.ok(await commandDeck.getByText('DEIN UNIVERSUM.').count(),'Command Deck headline missing');
    await commandDeck.scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'ascend-deck');
    await commandDeck.getByRole('button',{name:/STATISTIKEN ÖFFNEN/}).click();
    const statsFold=page.locator('#psn-insights-fold');
    assert.ok(await statsFold.evaluate(el=>el.open),'Mission Deck must open the existing insights fold');
    const activityFeed=page.getByRole('region',{name:'Dein Gaming Activity Feed'});
    await activityFeed.waitFor();
    await activityFeed.getByRole('button',{name:'TROPHÄEN'}).click();
    assert.equal(await activityFeed.getByRole('button',{name:'TROPHÄEN'}).getAttribute('aria-pressed'),'true','Trophy feed filter must respond');
    await activityFeed.getByRole('button',{name:'SPIELE'}).click();
    assert.equal(await activityFeed.getByRole('button',{name:'SPIELE'}).getAttribute('aria-pressed'),'true','Game activity filter must respond');
    await activityFeed.getByRole('button',{name:'ALLE EREIGNISSE'}).click();
    await activityFeed.scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'activity-feed');
    const monitor=page.getByRole('region',{name:'PSN Monitor Sitzungsanalyse'});
    await monitor.waitFor();
    await monitor.locator('select').selectOption('UTC');
    const monitorCsv=[
     '"Date","Status","Game name"',
     '"2026-11-19 10:00:00","online","CI Game Alpha"',
     '"2026-11-19 11:00:00","online","CI Game Beta"',
     '"2026-11-19 12:30:00","offline",""'
    ].join('\n');
    const uploadMonitor=()=>monitor.locator('input[type="file"]').setInputFiles({
     name:'synthetic-monitor.csv',mimeType:'text/csv',buffer:Buffer.from(monitorCsv,'utf8')
    });
    await uploadMonitor();
    await monitor.getByText('2 abgeschlossene Intervalle',{exact:false}).waitFor();
    await monitor.getByRole('button',{name:/PRÜFUNG BESTÄTIGEN/}).click();
    await monitor.getByText('2 neue beobachtete Intervalle importiert.',{exact:false}).waitFor();
    const firstSessions=await page.evaluate(()=>JSON.parse(localStorage.getItem('psn-observed-game-sessions-v1')||'[]'));
    assert.equal(firstSessions.length,2,'Monitor import should persist exactly two intervals');
    assert.deepEqual(firstSessions.map(x=>x.minutes),[60,90],'Monitor should preserve actual observed intervals');
    await uploadMonitor();
    await monitor.getByRole('button',{name:/PRÜFUNG BESTÄTIGEN/}).click();
    await monitor.getByText('0 neue beobachtete Intervalle importiert.',{exact:false}).waitFor();
    await monitor.scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'monitor-import');
    const timeLab=page.getByRole('region',{name:'Spielzeit-Labor und persönliche Zeitziele'});
    await timeLab.waitFor();
    const manualTimeCard=timeLab.locator('article').filter({hasText:'Unplayed CI Test'}).first();
    await manualTimeCard.waitFor();
    assert.match(await manualTimeCard.innerText(),/12,5 h/,'Personal time goal must survive browser reload and remain visible');
    assert.match(await manualTimeCard.innerText(),/Kein gültiger kumulierter PSN-Spielzeitwert/,'Manual-only games must not gain fake PSN playtime');
    await timeLab.getByLabel('ANZEIGE').selectOption('goals');
    assert.ok(await manualTimeCard.count(),'Goal filter must preserve planned manual game');
    await timeLab.getByLabel('ANZEIGE').selectOption('relevant');
    const timeSize=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(timeSize.scroll<=timeSize.client+3,'Time lab mobile horizontal overflow: '+JSON.stringify(timeSize));
    await timeLab.scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'time-goals-lab');
    await page.locator('.psn-chronicle').waitFor();
    const collector=page.getByRole('region',{name:'Trophy Collector Card Studio'});
    await collector.waitFor();
    await collector.getByRole('button',{name:'GOLD EDITION'}).click();
    assert.equal(await collector.getByRole('button',{name:'GOLD EDITION'}).getAttribute('aria-pressed'),'true','Foil preview must respond to selection');
    await collector.scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'collector-card');
    const motionButton=collector.getByRole('button',{name:/ANIMIERTE VIDEO-KARTE EXPORTIEREN|HOLO-VIDEO WIRD ERSTELLT/});
    await motionButton.waitFor();
    const motionAvailable=await collector.evaluate(()=>typeof MediaRecorder!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function');
    if(!motionAvailable)assert.ok(await motionButton.isDisabled(),'Unsupported video browsers must not attempt recording');
    const exportButton=collector.getByRole('button',{name:/KARTE ALS SVG EXPORTIEREN/});
    const empty=await collector.locator('select').isDisabled();
    if(empty)assert.ok(await exportButton.isDisabled(),'No PSN trophy data: export must stay disabled');
    if(engine===chromium&&width===390&&!empty&&await motionButton.isEnabled()){
     const downloadPromise=page.waitForEvent('download',{timeout:16000});
     await motionButton.click();
     const videoDownload=await downloadPromise;
     assert.match(videoDownload.suggestedFilename(),/PS5-Radar-.*-Holo-Card\.(?:mp4|webm)$/, 'Motion export must produce a video');
     await collector.getByText(/Holo-Video exportiert als/).waitFor();
    }
    await commandDeck.getByRole('button',{name:/KAUFHISTORIE/}).click();
    const orders=page.getByRole('region',{name:'PlayStation-Kaufhistorie und Ausgabenanalyse'});
    await orders.waitFor();
    await orders.locator('input[type="file"]').setInputFiles({
     name:'synthetic-orders.csv',mimeType:'text/csv',
     buffer:Buffer.from('Date,Name,Category,Price paid,Store price,Refunded,Transaction ID\\n2026-11-20,CI Game Alpha,Purchased,35.99,69.99,No,txa\\n2026-11-19,CI PS Plus,PS Plus,0,59.99,No,txb\\n2026-11-19,CI Refunded,Purchased,10,50,Yes,txc'.replaceAll('\\n','\n'))
    });
    await orders.getByText('3 Positionen im Browser eingelesen.',{exact:false}).waitFor();
    assert.match(await orders.innerText(),/35,99/,'Net spending must exclude refunded games');
    await orders.scrollIntoViewIfNeeded();
    const contentClips=await orders.evaluate(root=>{
     const rootRight=root.getBoundingClientRect().right;
     const nodes=[root.querySelector('h4'),root.querySelector('p'),root.querySelector('input[type="file"]')];
     return nodes.filter(Boolean).map(el=>({
      label:el.tagName,scroll:el.scrollWidth,client:el.clientWidth,
      right:el.getBoundingClientRect().right,rootRight
     }));
    });
    for(const item of contentClips){
     if(item.label!=='INPUT')assert.ok(item.scroll<=item.client+2,engine.name()+' order text clipped internally: '+JSON.stringify(item));
     assert.ok(item.right<=item.rootRight+1,engine.name()+' order content extends beyond card: '+JSON.stringify(item));
    }
    await captureQa(page,engine.name(),width,'order-intelligence');
    await orders.getByRole('button',{name:'DATEN VERWERFEN'}).click();
    assert.ok(await orders.getByText('Importdaten aus dieser Ansicht gelöscht.').count(),'Clear must drop in-memory import');

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
    await page.locator('.psn-cinema-hero').scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'desktop-hero');
    await page.locator('.psn-hub-library-head').scrollIntoViewIfNeeded();
    await captureQa(page,engine.name(),width,'desktop-library');
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
  const relevantErrors=clientErrors.filter(t=>/PlayStationHub|GamingPlanner|PlatinumMissionControl|GamingChronicle|CommandDeck|TrophyCardStudio|DeadlinePanel|hydrate|hydration|before initialization|ReferenceError/i.test(t));
  assert.deepEqual(relevantErrors,[],engine.name()+' '+width+' runtime/hydration errors');
  await context.close();
 }
 }finally{await browser.close()}
}
console.log('PSN private routes, responsive Chromium and touch-enabled WebKit browser smoke checks passed');
