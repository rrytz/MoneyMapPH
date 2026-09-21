/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

// Declares the value of the `injectionPoint` (`self.__SW_MANIFEST`) to TypeScript.
// The string is replaced by the real precache manifest at build time.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Static build assets (JS/CSS/fonts/media under /_next/static, plus precached
// public files) — serve from cache, refresh in the background.
const staticAssetsCache = new StaleWhileRevalidate({
  cacheName: "moneymap-static",
  plugins: [
    new ExpirationPlugin({
      maxEntries: 64,
      maxAgeSeconds: 30 * 24 * 60 * 60,
      maxAgeFrom: "last-used",
    }),
  ],
});

// Page navigations — network first, fall back to the cache, then to /~offline.
const pagesCache = new NetworkFirst({
  cacheName: "moneymap-pages",
  networkTimeoutSeconds: 5,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 7 * 24 * 60 * 60,
      maxAgeFrom: "last-used",
    }),
  ],
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Same-origin static assets fetched at runtime.
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        (request.destination === "style" ||
          request.destination === "script" ||
          request.destination === "font" ||
          request.destination === "image" ||
          request.destination === "worker" ||
          url.pathname.startsWith("/_next/static/")),
      handler: staticAssetsCache,
    },
    // Same-origin API routes are never cached — authorization-gated.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
    },
    // Navigations: NetworkFirst, with the precached /~offline fallback.
    {
      matcher: ({ request }) => request.mode === "navigate" || request.destination === "document",
      handler: pagesCache,
    },
    // Everything else (RSC payloads, prefetches, cross-origin calls such as
    // Supabase) always goes to the network — never cached.
    {
      matcher: () => true,
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();