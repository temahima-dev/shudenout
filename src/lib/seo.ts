import { type Metadata } from "next";

export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  structuredData?: object;
}

const DEFAULT_CONFIG = {
  siteName: "ShuDen Out - 終電あとホテル",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://shudenout.com",
  defaultTitle: "ShuDen Out - 終電あとホテル | 今すぐ予約できるホテル検索",
  defaultDescription: "終電を逃した時でも安心。現在地から1km圏内のホテルを即座に検索。楽天トラベルと連携で確実に予約できます。東京都内の新宿・渋谷・上野エリア対応。",
  defaultKeywords: [
    "終電", "ホテル", "当日予約", "深夜", "緊急宿泊", 
    "新宿", "渋谷", "上野", "東京", "ビジネスホテル",
    "現在地検索", "楽天トラベル", "即予約"
  ],
  defaultOGImage: "/og-image.png",
  twitterHandle: "@shudenout"
};

/**
 * ページ用のメタデータを生成
 */
export function generateMetadata(config: SEOConfig = {}): Metadata {
  const {
    title,
    description = DEFAULT_CONFIG.defaultDescription,
    keywords = DEFAULT_CONFIG.defaultKeywords,
    canonical,
    ogImage = DEFAULT_CONFIG.defaultOGImage,
    ogType = "website",
    twitterCard = "summary_large_image"
  } = config;

  const fullTitle = title 
    ? `${title} | ${DEFAULT_CONFIG.siteName}`
    : DEFAULT_CONFIG.defaultTitle;

  const canonicalUrl = canonical 
    ? `${DEFAULT_CONFIG.siteUrl}${canonical}`
    : DEFAULT_CONFIG.siteUrl;

  const ogImageUrl = ogImage.startsWith('http') 
    ? ogImage 
    : `${DEFAULT_CONFIG.siteUrl}${ogImage}`;

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(", "),
    
    // 基本的なSEOタグ
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: canonicalUrl,
    },

    // Open Graph
    openGraph: {
      type: ogType,
      siteName: DEFAULT_CONFIG.siteName,
      title: fullTitle,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      locale: "ja_JP",
    },

    // Twitter Card
    twitter: {
      card: twitterCard,
      site: DEFAULT_CONFIG.twitterHandle,
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },

    // その他
    authors: [{ name: "ShuDen Out Team" }],
    creator: "ShuDen Out",
    publisher: "ShuDen Out",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },

    // アプリ関連
    appleWebApp: {
      capable: true,
      title: "ShuDen Out",
      statusBarStyle: "default",
    },

    // Verification（本番では実際のIDに置き換え）
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: {
        "msvalidate.01": process.env.BING_SITE_VERIFICATION || "",
      },
    },
  };
}

/**
 * 構造化データ（JSON-LD）を生成
 */
export function generateStructuredData(type: "website" | "hotel" | "localBusiness", data?: any): object {
  const baseData = {
    "@context": "https://schema.org",
    "@type": type === "website" ? "WebSite" : type === "hotel" ? "Hotel" : "LocalBusiness",
  };

  switch (type) {
    case "website":
      return {
        ...baseData,
        "@type": "WebSite",
        "name": DEFAULT_CONFIG.siteName,
        "url": DEFAULT_CONFIG.siteUrl,
        "description": DEFAULT_CONFIG.defaultDescription,
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${DEFAULT_CONFIG.siteUrl}/?area={search_term_string}`
          },
          "query-input": "required name=search_term_string"
        },
        "sameAs": [
          // SNSアカウントがある場合
        ]
      };

    case "hotel":
      return {
        ...baseData,
        "@type": "Hotel",
        "name": data?.name || "",
        "description": data?.description || "",
        "image": data?.imageUrl || "",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": data?.area || "東京都",
          "addressCountry": "JP"
        },
        "geo": data?.latitude && data?.longitude ? {
          "@type": "GeoCoordinates",
          "latitude": data.latitude,
          "longitude": data.longitude
        } : undefined,
        "priceRange": data?.priceRange || "¥¥",
        "aggregateRating": data?.rating ? {
          "@type": "AggregateRating",
          "ratingValue": data.rating,
          "ratingCount": data.reviewCount || 1
        } : undefined
      };

    case "localBusiness":
      return {
        ...baseData,
        "@type": "LocalBusiness",
        "name": DEFAULT_CONFIG.siteName,
        "description": DEFAULT_CONFIG.defaultDescription,
        "url": DEFAULT_CONFIG.siteUrl,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "東京",
          "addressCountry": "JP"
        },
        "serviceArea": {
          "@type": "AdministrativeArea",
          "name": "東京都"
        }
      };

    default:
      return baseData;
  }
}

/**
 * パンくずリスト構造化データを生成
 */
export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${DEFAULT_CONFIG.siteUrl}${item.url}`
    }))
  };
}

/**
 * FAQ構造化データを生成
 */
export function generateFAQStructuredData(faqs: Array<{ question: string; answer: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}


