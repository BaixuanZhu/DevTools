# 图片工具增强（Header 快捷入口 / ICO 独立工具 / 格式扩展）

## Goal

父任务：统筹三项图片工具相关增强，负责需求全集、子任务地图与最终集成验收。三项改动相互独立、可分别上线，但共享同一个需求来源（用户对图片转换与压缩工具的三点不满）与同一批周边文件（`src/data/tools.ts` 等），由父任务保证合并后的一致性。

## Background（用户原话与决策）

用户反馈：

1. 图片转换与压缩是高频工具，希望 PC 分辨率下把 Header 中部空白利用起来，放入最常被使用工具的入口。
2. ICO 格式图片很特殊，希望从图片转换工具中单独提取为独立工具。
3. 希望增加更多格式转换支持。

已确认决策（2026-08-30 与用户对齐）：

- **任务结构**：父任务 + 3 个子任务，各自独立规划/实现/验收。
- **Header 快捷入口**：固定精选列表（非 localStorage 使用频率统计）。
- **格式扩展范围**：BMP 输出、GIF 输出、SVG 输入、HEIC/HEIF 输入，四项全做。

## Requirements（需求全集）

### R1 PC 端 Header 快捷入口（子任务 08-30-header-quick-links）

- 桌面断点（≥lg，与 Sidebar 出现断点一致）下，Header 中部展示固定精选的高频工具快捷入口（4~6 个）。
- 移动端（<lg）不渲染，Header 布局保持现状。
- 当前所在工具对应入口有激活态高亮；暗色主题适配（代码现状已有 `.dark` 令牌组）。
- 精选清单以数据文件形式维护，可随时调整而不改组件。

### R2 ICO 图标制作工具（子任务 08-30-ico-converter-tool）

- 新增**创作型**独立工具页 `/frontend/ico-maker`（用户评审意见：形态更像创作——"放一个图，可以截取一部分转换为 ICO"）：
  - 制作 ICO：导入图 → 内嵌裁切（复用 ImageCropper，默认 1:1，可跳过）→ 尺寸多选/适配/填白 → 逐尺寸实时预览 → 下载 .ico 与各尺寸 PNG。
  - 解析 ICO：解析 .ico/.cur 文件，列出内嵌图像（PNG 与 BMP 条目）并逐个提取为 PNG 下载。
- 图片转换与压缩工具移除 ICO 输出格式与专属控件，描述/SEO/FAQ 同步去 ICO 化，`relatedToolIds` 互指。
- 底层 `encodeIco` 保留复用；新增 ICO 解析纯函数；`ImageCropper` 仅加可选 `defaultAspect` prop（向后兼容）。

### R3 格式转换扩展（子任务 08-30-image-format-expansion）

- 输出新增：BMP（自研编码器，无新依赖）、GIF（gifenc，静态单帧）。
- 输入新增：SVG（浏览器原生光栅化）、HEIC/HEIF（libheif-js，动态 import 懒加载）。
- 空态文案、输入格式推荐、SEO 文案、FAQ 同步更新；新增/调整均配套单测。

## Child Task Map

| 子任务 | 交付物 | 依赖 |
|--------|--------|------|
| 08-30-header-quick-links | Shell Header 快捷入口 + 精选清单数据 | 无 |
| 08-30-ico-converter-tool | `/frontend/ico-maker` 创作型 ICO 工具页 + 图片转换器去 ICO 化 | 无 |
| 08-30-image-format-expansion | BMP/GIF/SVG/HEIC 编解码 + 转换器文案更新 | 建议在 ico-converter-tool 之后（同为 image-convert.ts 改动，避免合并冲突） |

实施顺序建议：header-quick-links → ico-converter-tool → image-format-expansion。

## Cross-child Acceptance Criteria（父任务最终集成验收）

- [ ] 三个子任务各自验收通过并归档。
- [ ] `pnpm build`、`pnpm test`、`pnpm astro check` 全部通过。
- [ ] `tools.ts` 中 image-converter 与 ico-maker 的描述/关键词/FAQ/relatedToolIds 无相互矛盾（ICO 能力描述只出现在 ico-maker）。
- [ ] Header 快捷入口与 Sidebar/搜索在新工具集下数据一致（工具数徽标含 ico-converter）。
- [ ] 新增工具页出现在分类页、sitemap（工具页 0.8）与搜索面板。
- [ ] PRODUCT.md 工具分类表的前端与媒体工具数与实际同步。

## Out of Scope

- GIF 动图（多帧）输入输出——仍按静态单帧处理，FAQ 已声明。
- Header 入口的个性化排序 / 使用频率统计——用户已明确选固定精选。
- HEIC 编码输出（仅解码输入）。
- 其他格式（如 ICO 批量生成多图）。
