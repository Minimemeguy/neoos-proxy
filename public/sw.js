// ============================================================
//  Scramjet Service Worker
//
//  This file runs silently in the browser background.
//  It intercepts EVERY network request the page makes
//  and routes matching ones through the Scramjet proxy.
//
//  Must be served from the root of your site (/sw.js)
//  so its scope covers the whole origin.
// ============================================================

// Load the Scramjet engine bundle
importScripts("/scram/scramjet.all.js");

// Get the service worker class from Scramjet
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Activate immediately — don't wait for old workers to die
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

// Intercept every fetch request
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      // Load the Scramjet config sent from the main page
      // (codec settings, prefix, etc.)
      await scramjet.loadConfig();

      // If this URL matches a proxied Scramjet URL → proxy it
      if (scramjet.route(event)) {
        return scramjet.fetch(event);
      }

      // Otherwise let the browser handle it normally
      return fetch(event.request);
    })()
  );
});
