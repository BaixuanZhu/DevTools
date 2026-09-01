# 设计：Markdown 导出 HTML 预览与多主题

## 模块边界

### `src/utils/editor/markdown-export.ts`（重构）

- 新增类型 `HtmlExportTheme` 与注册表 `HTML_EXPORT_THEMES`：`{ id, name, variables }`，variables 为该主题的 CSS 变量集。
- `buildHtmlDocument(markdown, options)` 由私有改为公开导出：预览与下载共用同一条产物生成路径，保证所见即所得。
  - `options: { themeId?: string; title?: string }`，`themeId` 缺省 `classic-light`；
  - **只烘焙所选主题**（二轮反馈：主题选择收敛在对话框，产物去切换器/去脚本，完全静态）：`<style>` = 基础排版（只消费变量）+ 该主题 `:root[data-theme]` 变量段 + 可选 `extraCss` 附加规则（表达变量无法覆盖的结构性特色，如渐变标题、标题侧边条）；
  - `<title>` 用 `options.title`（缺省回退 `Markdown Export`）。
- `exportHtml(markdown, filename, options?)` 签名向后兼容地扩展，透传 options。

### 新组件 `src/components/markdown/HtmlExportDialog.vue`

- props：`open`（v-model:boolean）、`markdown: string`、`title: string`、`filename: string`；emit `update:open`。
- 内部状态 `themeId`（默认 `classic-light`），计算属性 `previewDoc = buildHtmlDocument(markdown, { themeId, title })`。
- 预览容器：`<iframe sandbox="" :srcdoc="previewDoc">`（空 sandbox 全沙箱：产物无脚本可执行，静态展示）。
  - 每次 `themeId` 变化重新生成 srcdoc，预览即最终产物；
  - 对话框主题胶囊（radiogroup）是主题唯一选择入口。
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

主题结构性特色用可选 `extraCss`（完整 CSS 规则，产物内 4 空格缩进对齐）表达；另有序号/层级问题见「安全」。

主题定义（5 套）：

| id | 名称 | 基调 |
|----|------|------|
| classic-light | 经典浅色 | 现有 zinc 浅色观感迁移 |
| aurora | 极光渐变 | 全新：紫蓝渐变 h1/h2、深靛代码块（二轮反馈替代「暗色」，要求非暗色系） |
| wechat | 微信公众号 | 17px 大字号、宽松行距、绿色强调、代码浅灰底 |
| serif | 极简衬线 | 衬线字体、纸感配色、细分割线 |
| tech-blue | 科技蓝 | 重做：掘金系配色 #1e80ff、h2 蓝色侧边条、深色代码块 |

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

## 层级

- 共享 `ui/dialog/DialogContent.vue` 遮罩与内容抬到 `z-[21000]`：md-editor-v3 内部 dropdown/modal 为 z-index 20000-20001、全屏 10000，z-50 会被盖住；该封装消费方仅工作台两处（导出预览 + 删除确认），抬层纯收益。

## 安全

- 产物完全静态（无 `<script>`，单测固化）；
- 预览 iframe 空 `sandbox` 全沙箱（禁脚本）；
- marked 对内联 HTML 的透传与现状一致，不在本任务扩大或收窄。
