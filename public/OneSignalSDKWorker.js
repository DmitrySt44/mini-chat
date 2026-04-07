self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // нужен для installable PWA
});

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");