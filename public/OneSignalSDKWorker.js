self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Пустой fetch-handler нужен Chrome, чтобы сайт считался installable PWA.
});

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");