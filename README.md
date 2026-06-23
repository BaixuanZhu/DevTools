<div align="center">

# DevTools

**开发者工具箱 — 浏览器端即开即用**

40 个常用开发者工具，全部在浏览器本地运算 · 零登录 · 零数据上传

[🌐 在线访问](https://tools.baixuanz.cn) · [English](./README.en.md)

</div>

---

## 特性

- **即开即用** — 打开即是工具本身，主输入框自动聚焦，从想到「我需要一个工具」到拿到结果不超过 5 秒
- **纯本地运算** — 所有数据处理在浏览器完成，无后端、无数据上传，断网可用
- **零门槛** — 无需登录、安装或配置，尊重隐私
- **轻量高效** — 单工具页 JS < 50KB（gzip），按需水合，Lighthouse Performance ≥ 90
- **中文友好** — 界面、错误提示与 SEO 均针对中文开发者优化

## 工具总览

共 **40 个工具，12 个分类**，按 `/category/tool-name` 二级路由组织。

| 分类 | 代表工具 |
| --- | --- |
| 编码转换 | Base64 · URL · JWT 编解码 |
| 加密哈希 | 哈希 · 对称加密 · SM2/SM4 国密 |
| 日期时间 | 时间戳转换 · Cron 表达式解析 |
| 格式化 | JSON 格式化 / 差异对比 · JSON ↔ XML / YAML |
| 网络工具 | 设备与 UA 解析 · HTTP 状态码 · IPv4 子网计算 |
| 文本处理 | UUID · 随机字符串 |
| 媒体工具 | 二维码生成与识别 · 图片格式转换 |
| 其他 | 正则 · 颜色 · CSS · Markdown 编辑器 · Docker 配置转换 |

> 完整清单见 [tools.baixuanz.cn](https://tools.baixuanz.cn)，注册表源码位于 `src/data/tools.ts`。

## 技术栈

- **框架** — Astro 6（SSG）+ Vue 3（工具交互）+ Alpine.js（全局壳层）
- **样式** — Tailwind CSS v4，设计令牌集中管理
- **语言** — TypeScript（strict）
- **可访问性组件** — Headless UI（Vue）
- **耗时运算** — Web Worker，避免阻塞主线程
- **工具链** — pnpm · Node ≥ 22.12

## 快速开始

```sh
pnpm install
pnpm dev        # 本地开发，http://localhost:4321
```

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本到 `./dist/` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm test` | 运行 Vitest 测试 |
| `pnpm astro check` | TypeScript 类型检查 |

## 项目结构

```text
src/
├── layouts/      # 页面骨架（Layout、ToolLayout）
├── pages/        # 文件路由
├── tools/        # 工具页面，按分类分目录（encoding/、crypto/ …）
├── components/   # 可复用组件（.vue 交互型 + .astro 展示型）
├── composables/  # Vue 组合式函数
├── data/         # 工具注册表与 FAQ
├── utils/        # 工具函数与 Web Worker
└── styles/       # 设计令牌
```

## 部署

纯静态站点，可部署到任意静态托管：

- **EdgeOne Pages** — 主站点 [tools.baixuanz.cn](https://tools.baixuanz.cn)
- **GitHub Pages** — 通过 GitHub Actions 自动构建部署（见 `.github/workflows/`）

## 协议

[MIT](./LICENSE)
