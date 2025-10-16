import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shudenout.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();
  
  return [
    // メインページ
    {
      url: SITE_URL,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    
    // エリア別ページ
    {
      url: `${SITE_URL}/?area=shinjuku`,
      lastModified: currentDate,
      changeFrequency: "daily", 
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?area=shibuya`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?area=ueno`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?area=shinbashi`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?area=ikebukuro`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?area=roppongi`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    
    // 価格帯別ページ
    {
      url: `${SITE_URL}/?priceFilter=~5000`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/?priceFilter=~10000`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/?priceFilter=10000~`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    
    // 設備別ページ
    {
      url: `${SITE_URL}/?amenities=WiFi`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/?amenities=シャワー`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/?amenities=2人可`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    
    // 法的ページ・サポート
    {
      url: `${SITE_URL}/faq`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2024-01-01"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy-policy`,
      lastModified: new Date("2024-10-16"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
