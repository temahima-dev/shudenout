import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
