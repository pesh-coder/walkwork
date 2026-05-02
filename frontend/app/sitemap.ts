import type { MetadataRoute } from "next";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tukole-woad.vercel.app";

interface SellerLite {
  slug: string | null;
  created_at: string;
}

/**
 * Sitemap — tells Google about every page worth crawling.
 *
 * Auto-regenerates on each deploy. Includes the homepage, /explore (the
 * directory), and every seller's public profile page.
 *
 * Cached for 1 hour to avoid hammering the API on every crawl.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let sellers: SellerLite[] = [];
  try {
    const res = await fetch(`${API_BASE}/sellers`, {
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (res.ok) {
      sellers = await res.json();
    }
  } catch {
    // If the API is unreachable, ship a sitemap with just the static pages
  }

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/explore`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const sellerPages: MetadataRoute.Sitemap = sellers
    .filter((s) => s.slug)
    .map((s) => ({
      url: `${SITE_URL}/s/${s.slug}`,
      lastModified: new Date(s.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...sellerPages];
}
