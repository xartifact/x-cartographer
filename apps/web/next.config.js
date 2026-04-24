/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 让 Node.js 直接加载这些包，避免 webpack bundle 导致的 URL cross-realm 问题
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  images: {
    domains: [],
  },

  env: {
    NEXT_PUBLIC_APP_NAME: 'X-Product-Roadmap',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

module.exports = nextConfig;
