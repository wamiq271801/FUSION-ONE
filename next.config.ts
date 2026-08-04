import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: ['*.space-z.ai'],
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@react-pdf/renderer',
    'puppeteer',
  ],
  turbopack: {
    resolveAlias: {
      '@internal/whatsapp-engine': './internal/whatsapp-web.js/engine/index.ts',
      '@internal/whatsapp-web.js': './internal/whatsapp-web.js/index.js',
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    const alias = config.resolve.alias as Record<string, string>;
    alias['@internal/whatsapp-engine'] = path.resolve(__dirname, 'internal/whatsapp-web.js/engine/index.ts');
    alias['@internal/whatsapp-web.js'] = path.resolve(__dirname, 'internal/whatsapp-web.js/index.js');
    return config;
  },
  images: {
    unoptimized: true,
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
};

export default nextConfig;
