const CACHE_NAME="bharat-viral-admin-v3";
const SHELL=["/admin.html","/admin-manifest.json","/admin-icon-192.png","/admin-icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys().then(keys => Promise.all(
    keys.map(key => {
      if(key !== CACHE_NAME && key.startsWith("bharat-viral-admin")) return caches.delete(key);
    })
  )).then(()=>self.clients.claim())
));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const u=new URL(e.request.url);
  if(u.hostname.includes("supabase.co")) return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
