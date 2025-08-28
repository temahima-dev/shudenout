import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shudenout.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",           // API エンドポイントは除外
          "/_next/",         // Next.js内部ファイル
          "/admin/",         // 管理画面（将来用）
        ],
      },
      {
        userAgent: "GPTBot",   // ChatGPT等のAIボット
        disallow: "/",
      },
      {
        userAgent: "CCBot",    // Common Crawlボット
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}


