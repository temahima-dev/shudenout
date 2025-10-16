import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel警告解決
  outputFileTracingRoot: process.cwd(),
  
  experimental: { 
    serverActions: {
      allowedOrigins: ['localhost:3000', 'shudenout.com', 'www.shudenout.com']
    }
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 強力なキャッシュ無効化設定（CDN問題解決）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store'
          },
          {
            key: 'X-Vercel-Cache',
            value: 'BYPASS'
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
