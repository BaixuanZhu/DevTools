# Implement — Markdown 编辑器独立工作台重构

## 执行清单（有序）

1. **依赖** — `pnpm add md-editor-v3`（✅ 已装 6.5.6）。prismjs **不移除**：实施核实 JsonFormatter.vue
   直接 import Prism（+ prism-json），是渲染链之外的第二消费方，依赖保留。
2. **注册表与路由** —
   - `src/data/tools.ts`：`markdown-editor` 条目 `path` → `/markdown`，`description`/`seoDescription` 更新为工作台定位文案。
   - `astro.config.mjs`：`CATEGORY_SLUGS`（或新增单段白名单集）加 `'markdown'` 并同步注释；`redirects` 加
     `'/devops/markdown-editor': '/markdown'`；`serialize` 中单段 `/markdown` priority 0.9。
   - `src/data/quick-links.ts`：`QUICK_LINK_TOOL_IDS` 追加 `'markdown-editor'`（第 6 位）。
3. **数据层** — `src/tools/markdown/doc-store.ts`（接口见 design.md）+ `__tests__/doc-store.test.ts`
   （内存 Storage 注入；覆盖解析容错/增删改/updatedAt 排序）。
4. **UI 层** —
   - `src/tools/markdown/MarkdownWorkstation.vue`：md-editor-v3 编辑器 + 三视图模式切换
     （仅编辑 / 分栏 / 仅预览，见 design.md 映射表）+ 主题跟随（themeStore.current）+
     图片粘贴 base64 + 导入 .md（input file）+ 导出 md/html + 自动保存（debounce → doc-store）；
     `onMounted` 调 `themeStore.load()`；挂 `<Toaster />`；顶栏含主题三态切换与文档操作。
   - `src/components/markdown/DocumentSidebar.vue`：文档列表（新建/切换/重命名/删除/更新时间显示）。
   - `src/pages/markdown.astro`：**完整 HTML 文档，不 import Layout.astro**——手写 `<head>`（title/description/
     keywords/canonical/SoftwareApplication JSON-LD）+ `import global.css`；body 仅全屏岛
     `client:only="vue"`，无 Shell/Footer/FAQ/介绍内容。
   - 【已执行 2026-08-30 追加】**扩展库全量本地化**——`pnpm add mermaid katex highlight.js screenfull
     cropperjs prettier echarts`，`MarkdownWorkstation.vue` 模块级 `config({ editorExtensions: { *.instance } })`
     注入本地实例，消除 md-editor-v3 默认的 7 处 unpkg 运行时加载（mermaid/katex/highlight.js/prettier/
     cropperjs/screenfull/echarts）；被替代的 CDN 样式本地 import（katex css+字体、cropper css、
     hljs atom-one-light + `.dark` 作用域 atom-one-dark 覆盖）；echarts `parseOption` 覆写为 `JSON.parse`
     （默认 new Function 触碰 Security Rules）。体积：岛 chunk raw 931KB → 3.48MB（gzip ≈ 285KB → 1.07MB），
     全部在懒加载岛内，主包不变；network 实测 unpkg 请求 0。
5. **删除旧实现与死数据** — `src/tools/devops/MarkdownEditor.vue`、`src/pages/devops/markdown-editor.astro`、
   `src/utils/editor/markdown-renderer.ts`、`src/utils/editor/markdown-toolbar.ts`；
   `markdown-export.ts` 保留（岛内继续用）；`tool-faqs.ts` 删除 `'markdown-editor'` 键。
   **prismjs 保留**（JsonFormatter.vue 第二消费方，勿移除）。
6. **文档同步** — PRODUCT.md §URL Strategy 例外说明；DESIGN.md 布局模板补"工作台页"。
7. **验证**（见下）。

## 验证命令

```bash
pnpm build          # 通过 + dist/ 含 markdown 重定向页
pnpm test           # 全绿（新增 doc-store 单测）
pnpm astro check    # 类型检查全绿
# 体积口径：对比 46841c1 与本次构建的首页主 chunk gzip（dist 输出），确认无增长
# sitemap 口径：dist/sitemap-*.xml 含 /markdown、不含 /devops/markdown-editor 与旧扁平页
# 301 口径：dist/devops/markdown-editor/index.html 存在且指向 /markdown
# 独立页口径：dist/markdown/index.html 无站点 Header/Sidebar/Footer/FAQ 标记，<head> 元数据齐全
```

补充检查：IDEA MCP `get_file_problems` 或 `search_text("w-[")` 排查任意值类名残留；全局 grep `prismjs`
应仅命中 package.json 与 src/tools/format/JsonFormatter.vue（依赖保留的第二消费方）。

## 风险文件与回滚点

- `astro.config.mjs` — sitemap filter 改错会影响全站收录；改后必须本地打开 dist sitemap 验证（步骤 7 口径）。
- `src/data/tools.ts` — path 变更波及分类页/搜索/相关工具/Sidebar；全由消费方读 path，勿改 id。
- 每步独立 commit；回滚点 = 步骤边界。

## task.py start 前检查

- [x] prd.md / design.md / implement.md 齐备且用户已批准最终摘要
- [x] implement.jsonl / check.jsonl 已含真实条目（spec/研究文档）
- [x] 浏览器冒烟项列入实现后验收：301 跳转、刷新恢复草稿、粘贴图片、暗色跟随、多文档切换
