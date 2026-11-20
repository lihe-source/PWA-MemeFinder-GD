const VERSION='V1_0';
const PREFIX='memefinder-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=['./','./index.html','./style.css','./app.mjs','./core.mjs','./drive.mjs','./search-worker.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const p of ASSETS){const req=new Request(new URL(p,self.registration.scope),{cache:'reload'});const res=await fetch(req);if(!res.ok)throw Error('Incomplete release');await cache.put(req,res);}})()));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname)||u.pathname.endsWith('/version.json')||u.pathname.endsWith('/sw.js'))return;e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(e.request,{ignoreSearch:true})||fetch(e.request);})());});
