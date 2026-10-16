import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Xevra - Examination System",
    short_name: "Xevra",
    description: "Create, take, and review exams. Practice weak topics and track your results.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#14151c",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My Exams", url: "/dashboard/my-exams" },
      { name: "My Results", url: "/dashboard/my-results" },
      { name: "Practice", url: "/dashboard/practice" },
    ],
  };
}
