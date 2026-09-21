import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.json (App Router file convention).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoneyMapPH",
    short_name: "MoneyMapPH",
    description:
      "Personal finance management for Filipinos — track expenses, budgets, income, and savings goals.",
    lang: "en",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
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