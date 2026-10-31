import type { MetadataRoute } from "next";

// Browser-installed shortcuts reuse the same approved CCPun portrait icon as
// the desktop favicon and iPhone/iPad touch icon, never the old Bitcoin art.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CCPun | ที่ปรึกษาทางการเงิน",
    short_name: "CCPun",
    description: "เว็บไซต์ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน CCPun",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#faf7f3",
    theme_color: "#352727",
    lang: "th",
    icons: [
      {
        src: "/assets/ccpun-favicon-v5-7253e60c.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
