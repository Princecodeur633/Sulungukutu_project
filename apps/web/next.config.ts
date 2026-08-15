import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;
