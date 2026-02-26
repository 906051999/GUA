import type { MetadataRoute } from "next";

function resolveSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: siteUrl ? new URL("/sitemap.xml", siteUrl).toString() : undefined,
    host: siteUrl ? siteUrl.host : undefined,
  };
}
