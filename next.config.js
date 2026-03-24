/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PGlite WASM 支持
  transpilePackages: ['@electric-sql/pglite'],

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

  // Webpack 配置：排除 Node.js 模块（PGlite 仅在客户端运行）
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
