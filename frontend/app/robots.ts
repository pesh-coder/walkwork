import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tukole-woad.vercel.app";

/**
 * robots.txt — tells crawlers what they can and can't fetch.
 *
 * - Allow all crawlers, all pages by default
 * - Disallow private surfaces: dashboards, tracking, admin
 * - Point to sitemap.xml
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/s/", "/explore"],
        disallow: ["/seller/", "/rider/", "/admin/", "/track/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
