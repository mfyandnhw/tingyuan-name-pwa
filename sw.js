const VERSION="tingyuan-pwa-v013";
const SHELL=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icons/icon.svg","./icons/icon-192.png","./icons/icon-512.png",
"./assets/traditional-rules.json","./assets/rules.json","./assets/interpretations.json","./assets/numerology-traits.json","./assets/strokes.json","./assets/surnames.json","./assets/name-strokes.json","./assets/stroke-variants.json"];
self.addEventListener("install",event=>event.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||!new URL(req.url).protocol.startsWith("http"))return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy));}
    return res;
  }).catch(()=>caches.match("./index.html"))));
});
