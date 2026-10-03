import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.json (App Router file convention).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agos",
    short_name: "Agos",
    description:
      "Personal finance management for Filipinos — track expenses, budgets, income, and savings goals.",
    lang: "en",
    start_url: "/dashboard",
    display: "standalone",
    // WebKit (iOS 16.4+) consults display_override for launch mode; making the
    // standalone intent explicit avoids any fallback to browser chrome.
    display_override: ["standalone", "minimal-ui"],
    // Explicit full-origin scope so every app route is in scope regardless of
    // how the manifest URL is derived.
    scope: "/",
    orientation: "portrait",
    // Dark paper, matching the startup images and loading.tsx. The previous
    // #020617 matched neither paper token, so any surface falling back to the
    // manifest backdrop flashed a third shade.
    background_color: "#0e1410",
    theme_color: "#0e1410",
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}