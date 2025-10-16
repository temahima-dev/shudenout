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
