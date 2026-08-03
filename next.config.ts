import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  /**
   * Tell Next.js (Turbopack or webpack) NOT to bundle these packages.
   * They contain native .node binaries or pure ESM builds that must be
   * required at runtime on the server — not statically analyzed.
   */
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@react-pdf/renderer',
    '@whiskeysockets/baileys',
  ],
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
