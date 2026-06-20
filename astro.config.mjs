// @ts-check
import {defineConfig} from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import sitemap, {ChangeFreqEnum} from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    site: 'https://tools.baixuanz.cn',
    build: {
        /**
         * 内联所有样式表到 HTML，避免额外的 render-blocking CSS 请求。
         * 站点使用 Tailwind CSS v4，生成的全局 CSS 是关键渲染资源，
         * 内联后可消除 `_astro/Layout.*.css` 对 LCP/FCP 的阻塞。
         */
        inlineStylesheets: 'always',
    },
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
            /**
             * 为每个 URL 添加 priority 和 changefreq，
             * 帮助搜索引擎理解页面重要程度和更新频率
             */
            serialize: ({url, ...rest}) => {
                const pathname = new URL(url).pathname.replace(/\/$/, '');

                // 首页：最高优先级，更新较频繁
                if (pathname === '') {
                    return {url, ...rest, priority: 1.0, changefreq: ChangeFreqEnum.WEEKLY};
                }

                // 工具页面：较高优先级，更新较少
                return {url, ...rest, priority: 0.8, changefreq: ChangeFreqEnum.MONTHLY};
            },
        }),
    ],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: ['gm-crypto'],
        },
    },
});
