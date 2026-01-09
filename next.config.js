/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 实验性功能
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 图片优化
  images: {
    domains: [],
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_APP_NAME: 'X-Product-Roadmap',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

module.exports = nextConfig;
