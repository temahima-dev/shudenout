import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      {
        protocol: "https",
        hostname: "jws.jalan.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
