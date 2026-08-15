/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // base 指向 monorepo 根：让 Tailwind 扫描到 packages/ui 的源码 class
    '@tailwindcss/postcss': {
      base: new URL('../../', import.meta.url).pathname,
    },
  },
};

export default config;
