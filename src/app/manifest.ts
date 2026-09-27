import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PrashnaSet — BPSC test practice",
    short_name: "PrashnaSet",
    description:
      "Curated BPSC question bank with timed tests, negative marking, spaced repetition, and honest progress tracking.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8f8fa",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
