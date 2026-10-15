import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "taiyariaada — Practice. Remember. Master.",
    short_name: "taiyariaada",
    description:
      "BPSC exam practice with timed tests, negative marking, spaced repetition, and honest progress tracking.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f3ef",
    theme_color: "#7b1838",
    icons: [
      {
        src: "/logo-mark.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
