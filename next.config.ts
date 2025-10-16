import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel警告解決
  outputFileTracingRoot: process.cwd(),
  
  // 完全キャッシュ無効化（Vercel全層対応）
  generateBuildId: () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  },
  
  experimental: { 
    serverActions: {
      allowedOrigins: ['localhost:3000', 'shudenout.com', 'www.shudenout.com']
    },
    // ISRキャッシュも無効化
    isrMemoryCacheSize: 0,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 核爆弾級キャッシュ無効化設定（全CDN層対応）
  async headers() {
    const timestamp = Date.now();
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0, stale-while-revalidate=0, stale-if-error=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: 'Thu, 01 Jan 1970 00:00:00 GMT'
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store, max-age=0'
          },
          {
            key: 'X-Vercel-Cache',
            value: 'BYPASS'
          },
          {
            key: 'X-Accel-Expires',
            value: '0'
          },
          {
            key: 'Vary',
            value: '*'
          },
          {
            key: 'Last-Modified',
            value: 'Thu, 01 Jan 1970 00:00:00 GMT'
          },
          {
            key: 'ETag',
            value: `"cache-bust-${timestamp}"`
          },
          {
            key: 'X-Cache-Bust',
            value: timestamp.toString()
          }
        ],
      },
    ];
  },
  
  // プライバシーページリダイレクト
  async redirects() {
    return [
      {
        source: '/privacy',
        destination: '/terms',
        permanent: true,
      },
      {
        source: '/privacy-policy',
        destination: '/terms',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      // 将来の本番用
      {
        protocol: "https",
        hostname: "img.travel.rakuten.co.jp",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
