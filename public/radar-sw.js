/* Public static assets only; never store authenticated HTML, GraphQL, profile or PSN responses. */
const VERSION='radar-public-assets-v1';
const PUBLIC_ASSETS=['/radar-icon.svg','/radar-offline.html'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PUBLIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('radar-public-assets-')&&k!==VERSION).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(async()=>await caches.match('/radar-offline.html')||Response.error()));
  return;
 }
 // Hashed, immutable frontend bundles and public icon only. NEVER cache /api or /mein-playstation data.
 if(!url.pathname.startsWith('/_next/static/')&&!PUBLIC_ASSETS.includes(url.pathname))return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(req,copy)).catch(()=>{});}
  return response;
 })));
});