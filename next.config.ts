import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  outputFileTracingIncludes: {
    '/api/whatsapp/send': ['node_modules/puppeteer/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'kegtzbebjdkiowvwhtha.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  serverExternalPackages: ['puppeteer'],
};

export default nextConfig;
