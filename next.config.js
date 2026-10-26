/** @type {import('next').NextConfig} */
module.exports = (phase) => {
  const isDev = phase === 'phase-development-server';
  const isVercel = Boolean(process.env.VERCEL);
  return {
    ...(isDev && !isVercel ? { distDir: '.next-dev' } : {}),
    ...(isVercel ? {} : { output: 'standalone' }),
    compress: true,
    swcMinify: true,
    poweredByHeader: false,
    images: {
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 60,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'telegram-automation-production-a593.up.railway.app',
        },
        {
          protocol: 'https',
          hostname: '**.railway.app',
        },
        {
          protocol: 'https',
          hostname: '**.supabase.co',
        },
      ],
    },
    experimental: {
      optimizePackageImports: ['lucide-react', 'framer-motion'],
    },
  };
};

