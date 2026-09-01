// @ts-check
import {defineConfig} from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import sitemap, {ChangeFreqEnum} from '@astrojs/sitemap';
import indexnow from 'astro-indexnow';

/**
 * 单段路径 sitemap 白名单：7 个分类 slug + 旗舰工作台页 /markdown。
 * 分类 slug 与 src/data/tools.ts 的 categorySlugMap 值保持一致（单源同步）；
 * markdown 是工作台专属单段路径，不在 categorySlugMap 内，故在此单独登记。
 */
const CATEGORY_SLUGS = new Set(['text', 'crypto', 'format', 'network', 'datetime', 'frontend', 'devops', 'markdown']);

/**
 * 旧两段 URL → 新两段 URL 重定向（分类合并 12→7 触发的路径迁移）。
 * Astro SSG 生成带 <meta http-equiv=refresh> + canonical 的重定向页，搜索引擎按 301 等价处理。
 * 源：docs/superpowers/specs/2026-07-22-navigation-redesign-design.md §3.2
 */
const CATEGORY_MERGE_REDIRECTS = {
    '/encoding/base64': '/text/base64',
    '/encoding/jwt-parser': '/text/jwt-parser',
    '/encoding/base64-to-image': '/text/base64-to-image',
    '/encoding/base64-to-file': '/text/base64-to-file',
    '/encoding/file-to-base64': '/text/file-to-base64',
    '/regex/tester': '/text/tester',
    '/css/unit-converter': '/frontend/unit-converter',
    '/css/gradient': '/frontend/gradient',
    '/color/panel': '/frontend/panel',
    '/media/qr-code-generator': '/frontend/qr-code-generator',
    '/media/qr-code-reader': '/frontend/qr-code-reader',
    '/media/image-converter': '/frontend/image-converter',
    '/media/image-scrambler': '/frontend/image-scrambler',
    '/media/phantom-tank': '/frontend/phantom-tank',
    // markdown-editor 升级为单段工作台路径后，旧扁平 URL 直接指向 /markdown，避免两跳重定向链
    '/editor/markdown-editor': '/markdown',
};

/**
 * markdown-editor 升级为独立旗舰工作台的路径迁移：旧两段工具页 URL 301 到单段 /markdown。
 * Astro 路由清单中 redirect 优先于同路径的文件路由，旧页面文件删除前重定向即已生效。
 */
const MARKDOWN_WORKSTATION_REDIRECTS = {
    '/devops/markdown-editor': '/markdown',
};

/**
 * IndexNow 密钥，等于 public/c90a69ccaca440b18dd4aff0cb43801c.txt 的文件名。
 * 协议要求该密钥文件公开可访问（https://tools.baixuanz.cn/<key>.txt）以验证站点所有权，
 * 密钥本身是公开信息，内联为常量不构成泄露，且免去 CI 环境变量配置。
 * 构建结束后 astro-indexnow 对比 dist HTML 哈希与缓存文件，只把新增/变更页面提交到
 * api.indexnow.org（自动分发 Bing/Yandex 等）；缓存 .astro-indexnow-cache.json 须提交入库，
 * 否则 EdgeOne 全新构建容器会每次全量重提。
 * GitHub Pages 工作流以 --base=/DevTools 构建，产出 URL 并非真实站点地址，
 * 通过 INDEXNOW_DISABLED=1 关闭该场景下的提交。
 */
const INDEXNOW_KEY = 'c90a69ccaca440b18dd4aff0cb43801c';

// https://astro.build/config
export default defineConfig({
    site: 'https://tools.baixuanz.cn',
    /** 两段 URL 分类合并迁移 + markdown 工作台单段路径迁移的 301 重定向（见上方两个重定向表） */
    redirects: { ...CATEGORY_MERGE_REDIRECTS, ...MARKDOWN_WORKSTATION_REDIRECTS },
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
        indexnow({
            key: INDEXNOW_KEY,
            enabled: process.env.INDEXNOW_DISABLED !== '1',
        }),
        sitemap({
            /**
             * 单段路径仅保留白名单内页面：7 个分类页（/text 等）+ 旗舰工作台页（/markdown），
             * 排除旧扁平重定向页（/base64 等）。多段路径（工具页）与首页全部保留。
             */
            filter: (page) => {
                try {
                    const pathname = new URL(page).pathname.replace(/\/$/, '');
                    const segments = pathname.split('/').filter(Boolean);
                    if (segments.length === 0) return true;                            // 首页
                    if (segments.length === 1) return CATEGORY_SLUGS.has(segments[0]); // 白名单单段页保留，旧扁平重定向排除
                    return true;                                                       // 工具页等多段
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

                const segments = pathname.split('/').filter(Boolean);
                // 白名单单段页（分类页与旗舰工作台页 /markdown）：优先级介于首页(1.0)与工具页(0.8)之间
                if (segments.length === 1 && CATEGORY_SLUGS.has(segments[0])) {
                    return {url, ...rest, priority: 0.9, changefreq: ChangeFreqEnum.WEEKLY};
                }

                // 工具页面：较高优先级，更新较少
                return {url, ...rest, priority: 0.8, changefreq: ChangeFreqEnum.MONTHLY};
            },
        }),
    ],
    vite: {
        plugins: [tailwindcss()],
        worker: {
            /**
             * @jsquash/avif 的多线程 emscripten worker（avif_enc_mt）会触发 code-splitting，
             * 而 Vite 默认 worker.format=iife 不支持 code-splitting，故改用 es。
             * 与项目现有 module worker（new Worker(..., { type: 'module' })）一致。
             */
            format: 'es',
        },
        optimizeDeps: {
            include: ['gm-crypto'],
            /**
             * @jsquash/avif 内含 emscripten 生成的 wasm 加载逻辑，
             * 预打包会改变 import.meta.url、破坏 wasm 相对路径导致加载失败，
             * 故排除预打包，让其按原始 ESM 被 serve（wasm 由 emscripten 自行 fetch）。
             */
            exclude: ['@jsquash/avif'],
        },
    },
});
