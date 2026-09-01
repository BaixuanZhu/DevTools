# 设计：Markdown 导出 HTML 预览与多主题

## 模块边界

### `src/utils/editor/markdown-export.ts`（重构）

- 新增类型 `HtmlExportTheme` 与注册表 `HTML_EXPORT_THEMES`：`{ id, name, variables }`，variables 为该主题的 CSS 变量集。
- `buildHtmlDocument(markdown, options)` 由私有改为公开导出：预览与下载共用同一条产物生成路径，保证所见即所得。
  - `options: { themeId?: string; title?: string }`，`themeId` 缺省 `classic-light`，同时把该主题烘为 `data-theme` 默认值；
  - 产物结构：`<style>` = 基础排版（只消费变量）+ 全部主题 `:root[data-theme="…"]` 变量段 + 切换器控件样式；`<script>` = 静态切换器；
  - `<title>` 用 `options.title`（缺省回退 `Markdown Export`）。
- `exportHtml(markdown, filename, options?)` 签名向后兼容地扩展，透传 options。
- 切换器脚本为静态内联 JS：切换 `<html data-theme>` + try/catch 包裹的 localStorage 持久化；无任何用户输入拼接，无 eval/Function（Security Rules）。localStorage 在沙箱/隐私环境抛异常时静默降级为仅会话内切换。

### 新组件 `src/components/markdown/HtmlExportDialog.vue`

- props：`open`（v-model:boolean）、`markdown: string`、`title: string`、`filename: string`；emit `update:open`。
- 内部状态 `themeId`（默认 `classic-light`），计算属性 `previewDoc = buildHtmlDocument(markdown, { themeId, title })`。
- 预览容器：`<iframe sandbox="allow-scripts" :srcdoc="previewDoc">`。
  - 每次 `themeId` 变化重新生成 srcdoc（所选主题烘为默认值），内嵌切换器在预览内真实可用；
  - 不给 `allow-same-origin` → iframe 处于不透明源，产物脚本无法触碰父页面/站点存储（对应用户自己生成的内容，与编辑器预览渲染用户 HTML 的既有风险面一致，此处取更严隔离）。
- 主题选择：按钮组（`role="radiogroup"` 语义），不用 Tabs 组件（其面板语义不匹配单选）。
- 底部操作：取消（DialogClose）+「下载 HTML」（调 `exportHtml` → toast → 关闭）。
- 样式遵循 DESIGN.md 令牌（`bg-background`/`border-border` 等），任意值仅用于设计令牌精确尺寸。

### `MarkdownWorkstation.vue` 接线

- `handleExportHtml` 改为打开对话框（`htmlExportOpen.value = true`）；文件名与标题经 `buildExportFilename` / `activeDoc.title` 传入；`.md` / PDF 菜单项不动。
- 挂载点：组件模板尾部（与 Toaster 同级）。

## 主题变量模型

每主题一组 CSS 变量，挂 `:root[data-theme="{id}"]`；基础排版只消费变量，新增主题成本 = 一组变量：

```
--mdc-bg / --mdc-fg / --mdc-muted / --mdc-border
--mdc-code-bg / --mdc-code-fg        （行内代码）
--mdc-pre-bg / --mdc-pre-fg          （代码块，支持「浅底行内码 + 深底代码块」组合）
--mdc-quote-bg / --mdc-quote-border
--mdc-link
--mdc-font-body / --mdc-font-code
--mdc-font-size / --mdc-line-height
--mdc-content-width
```

另有暗色主题夹带根声明 `color-scheme: dark`（原生控件/滚动条随主题）。

主题定义（5 套）：

| id | 名称 | 基调 |
|----|------|------|
| classic-light | 经典浅色 | 现有 zinc 浅色观感迁移 |
| dark | 暗色 | zinc 暗色 + 深底代码块 |
| wechat | 微信公众号 | 17px 大字号、宽松行距、绿色强调、代码浅灰底 |
| serif | 极简衬线 | 衬线字体、纸感配色、细分割线 |
| tech-blue | 科技蓝 | 蓝色强调、深色代码块、开发者社区观感 |

## 数据流

```
编辑器 content ──props──▶ HtmlExportDialog
                            │ themeId
                            ▼
              buildHtmlDocument(content, { themeId, title })
                 ├── iframe.srcdoc          （预览，sandbox 隔离）
                 └── Blob 下载              （导出，同一函数产物）
```

## 兼容与回滚

- `exportHtml` 既有调用方（仅工作台）同步迁移，参数可选、向后兼容；
- 无存储格式 / 路由 / sitemap 变更；回滚 = revert 单 commit。

## 安全

- 切换器脚本为静态字符串常量，不拼接用户输入；
- 预览 iframe `sandbox="allow-scripts"`（无 `allow-same-origin`）→ 不透明源隔离；
- marked 对内联 HTML 的透传与现状一致，不在本任务扩大或收窄。
