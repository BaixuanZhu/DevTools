# Design — Markdown 编辑器独立工作台重构

## 架构与边界

```
src/pages/markdown.astro                  # 独立一级页（SSG）：完整 HTML 文档（无 Layout/壳层/FAQ）+ 全屏岛
src/tools/markdown/
├── MarkdownWorkstation.vue               # 主岛（client:only="vue"）：md-editor-v3 工作台
├── doc-store.ts                          # 多文档草稿持久化（纯函数 + 可注入 storage，单测友好）
└── __tests__/doc-store.test.ts
src/components/markdown/
└── DocumentSidebar.vue                   # 私有子组件：文档列表（新建/切换/重命名/删除）
```

- **页面层**（`markdown.astro` = 完整 HTML 文档）：**不 import Layout.astro**（用户拍板的完全独立形态）。
  Astro 页面可直接输出 `<html>` 文档：`<head>` 内手写 title/description/keywords/canonical + SoftwareApplication
  JSON-LD（均为不可见元数据），`import '../../styles/global.css'` 引入设计令牌与暗色变量；
  `<body>` 仅一个全屏岛（`h-dvh overflow-hidden`），无 Shell/Header/Sidebar/Footer/面包屑/FAQ/介绍内容。
- **岛层**（`client:only="vue"`）：md-editor-v3 依赖浏览器 API，禁用 SSR 水合路径避免构建期报错，
  同时 client:only 在页面加载后立即水合（等同 client:load 时机）。
  岛自含站点级职责：`onMounted` 调 `themeStore.load()` 恢复主题；挂 vue-sonner `<Toaster />`
  （否则 toastStore 无渲染目标）；顶栏放主题三态切换控件（复用 Shell 现有切换控件，若其未抽成组件则就近实现同款）。
- **注册表层**：`tools.ts` 条目 `markdown-editor` 仅改 `path: '/markdown'` + 更新描述文案，
  `category` 保持 '开发与运维'（分类卡/Sidebar 徽标/搜索/相关工具全部经 `path` 取链接，零改动生效）。

## 数据契约 — doc-store

localStorage key：`devtools.markdown.docs.v1`，值为数组：

```ts
interface MarkdownDoc {
  id: string;        // crypto.randomUUID()
  title: string;     // 取首行 heading 或 '未命名文档'
  content: string;
  createdAt: number;
  updatedAt: number;
}
```

API：`listDocs() / getDoc(id) / saveDoc(id, content) / createDoc(template?) / renameDoc(id, title) / deleteDoc(id)`。
容错：JSON 解析失败或结构不符时重置为空数组并 console.warn（不抛错，编辑器永远可打开）。
所有函数接受可选 `storage: Storage` 参数（默认 localStorage），测试注入内存实现。

## 关键映射与依赖处理

| 事项 | 方案 |
|------|------|
| 主题 | `themeStore.current`（'light'/'dark'）→ md-editor `theme` prop，响应式跟随站点三态切换的解析结果 |
| 三视图模式 | 仅编辑：`MdEditor` 传 `:preview="false"`；分栏：`MdEditor` 默认形态；仅预览：`MdPreview` 独立只读组件（与编辑器共享同一套 markdown-it 扩展/主题配置） |
| 图片粘贴/拖拽 | md-editor 内置 onUploadImg 回调 → File 转 base64（FileReader）内联，无上传后端 |
| 导出 | `.md` 用 Blob 直接下载（保留 `utils/editor/markdown-export.ts` 的 downloadBlob/exportMarkdown）；`.html` 用现有 `marked` 轻量渲染 + 模板包装；PDF 走 md-editor 打印导出 |
| 编辑器 HTML 导出 | 复用 marked（其实际消费方为 markdown-export.ts 本身，依赖保留）；**不**再让 Prism 参与 |
| 扩展库本地化（2026-08-30 追加决策） | md-editor-v3 默认在运行时从 unpkg CDN 加载 7 个扩展：mermaid、katex、highlight.js、prettier、cropperjs、screenfull、echarts。国内用户对 unpkg 可达性不稳定且 mermaid 是点名的核心功能，全部改为 `config({ editorExtensions: { *.instance } })` 注入本地实例（守卫源码已核实：有 instance 即跳过对应 CDN script/link 追加）。被替代的 CDN 样式本地 import：katex.min.css（含字体资产）、cropper.css、hljs atom-one-light 全局 + atom-one-dark 令牌色以 `.dark` 作用域覆盖（codeTheme 默认 atom）。echarts 的 `parseOption` 同步安全覆写为 `JSON.parse`——默认实现用 `new Function` 兼容函数写法，触碰项目 Security Rules（禁 eval/Function 处理用户输入）；代价是 echarts 代码块仅接受纯 JSON 选项。体积影响：库体全部进懒加载岛 chunk（raw 931KB → 3.48MB / gzip 约 285KB → 1.07MB），主包不受影响（首页 chunk 合计 gzip ≈ 18.8KB 不变） |
| 依赖清理 | **prismjs 保留**——实施核实 JsonFormatter.vue 直接 `import Prism from 'prismjs'`（+ prism-json），是 markdown 渲染链之外的第二消费方；删除 `markdown-renderer.ts`、`markdown-toolbar.ts`、`MarkdownEditor.vue`、`pages/devops/markdown-editor.astro` |
| 体积 | md-editor-v3（含 mermaid/katex）只在岛 chunk，`client:only` 天然懒加载；验收口径 = 首页主 chunk gzip 相对 46841c1 不增长 |

## 兼容与迁移

- 301：`astro.config.mjs` `redirects` 增 `'/devops/markdown-editor': '/markdown'`（SSG 生成 meta-refresh 页，
  与现有分类合并重定向同机制，搜索引擎按 301 等价处理）。
- sitemap：单段路径白名单 `CATEGORY_SLUGS` 增 `'markdown'`（注释同步"旗舰工作台页"），serialize 中 `/markdown` 取 priority 0.9。
- 快捷入口：`quick-links.ts` 增 `'markdown-editor'` 为第 6 位（≤6 预算内，按频次序尾部）。
- FAQ 死数据清理：页面无 FAQ 后删除 `tool-faqs.ts` 的 `'markdown-editor'` 键。
- 文档同步：PRODUCT.md §URL Strategy 补"旗舰工作台单段路径 + 完全独立形态"例外；DESIGN.md 布局模板补工作台形态。

## 权衡记录

- **完全独立 vs 站点一致性**：用户拍板独立性优先——牺牲站点壳层一致性、面包屑、FAQ 长尾 SEO 与页面正文索引内容，
  换取纯粹的全屏编辑体验；SEO 仅保留 head 元数据与 SoftwareApplication JSON-LD，入口可达性由注册表
  （分类卡/搜索/相关工具/快捷入口）承担。
- **client:only vs client:idle**：牺牲编辑器区 SSR HTML（本来也无索引价值）换构建确定性和零 SSR 兼容成本。
- **双 markdown 库并存**（markdown-it 内置于 md-editor-v3 + marked 保留）：marked 是
  `markdown-export.ts` HTML 导出的渲染依赖（实施核实 JsonFormatter 并不消费 marked，早期判断失真），
  两者都是独立 chunk 内引用，主包不受影响；强行统一收益不成比例。
- **扩展库 CDN → 本地实例（2026-08-30 追加）**：默认 CDN 方案岛 chunk 最小（931KB raw），但 unpkg 在国内
  可达性不稳定，mermaid/katex/高亮离线全挂，与"mermaid 是核心功能"冲突。本地化后岛 chunk 增至
  3.48MB raw / 1.07MB gzip（mermaid 与 echarts 占大头），换取离线/被墙环境全功能与 0 CDN 请求；
  仅影响 /markdown 懒加载岛，主包与首屏性能口径不变。echarts 因 Security Rules 顺带把默认
  `new Function` 解析覆写为 `JSON.parse`（echarts 代码块降级为仅接受纯 JSON 选项）。
- **多文档草稿箱（用户未答，按推荐档执行）**：localStorage 数组方案增量小、可回退（v2 加模板库不破坏 schema）；
  若用户否决可裁剪为单文档 key，组件侧栏隐藏即可。

## 回滚

单任务单分支提交序列，每步一 commit；回滚 = revert 注册表 path + redirects + 恢复旧文件（全部在 git 历史内）。
风险文件：`astro.config.mjs`（sitemap filter 影响全站收录，改后需本地验证 sitemap-*.xml 含 /markdown 且不含旧扁平页）。
