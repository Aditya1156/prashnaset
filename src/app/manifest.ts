import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RattaMaro — Practice. Remember. Master.",
    short_name: "RattaMaro",
    description:
      "BPSC exam practice with timed tests, negative marking, spaced repetition, and honest progress tracking.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fdf9f7",
    theme_color: "#8e2f45",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
