import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Psykeus CNC Design Library",
    short_name: "Psykeus",
    description:
      "Browse and download CNC and laser cutting designs for your projects",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#292D32",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
