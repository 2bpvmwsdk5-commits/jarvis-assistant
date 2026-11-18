import type { MetadataRoute } from "next";

/** „Ausweis“ der App: Name, Farben und Symbole für die Installation. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "J.A.R.V.I.S. – Persönlicher Assistent",
    short_name: "JARVIS",
    description: "Ihr persönlicher, futuristischer KI-Assistent.",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07030f",
    theme_color: "#07030f",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
