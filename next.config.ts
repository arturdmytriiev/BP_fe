import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/bp-fe",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/bp-fe",
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
