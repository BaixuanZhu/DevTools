// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://tools.openbong.cloud',
  integrations: [
    vue(),
    sitemap({
      /** 排除旧扁平路径的重定向页面，只保留分类路径 */
      filter: (page) => {
        // 重定向页面的 URL 格式为 https://domain.com/slug/
        // 真实页面格式为 https://domain.com/category/slug/
        // 通过解析 pathname 判断是否为根级路径（恰好一段）
        try {
          const pathname = new URL(page).pathname.replace(/\/$/, '');
          const segments = pathname.split('/').filter(Boolean);
          // 根级单段路径即为旧重定向页
          return segments.length !== 1;
        } catch {
          return true;
        }
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
