# Product

## Users

全栈开发者。在日常开发中频繁需要各种小型工具：编码转换、JSON 格式化、正则调试、时间戳换算、哈希计算等。他们通常是多任务并行，需要一个工具时希望立刻打开、立刻用完、立刻离开。不需要登录、不需要配置、不需要学习。

## Product Purpose

一个零门槛的浏览器端开发者工具集合。每个工具即开即用，运算在本地完成，结果立即可得。成功标准是：用户从想到"我需要一个 XX 工具"到拿到结果，不超过 5 秒。

## Brand Personality

现代、友好、轻量。界面克制但不冷淡，交互有细节但不炫耀。像一个随叫随到的得力助手，安静高效，偶尔让人会心一笑。

## Competitor Landscape

与 [CyberChef](https://gchq.github.io/CyberChef/)（功能强大但界面复杂、学习曲线陡）、[DevToys](https://devtoys.app/)（桌面端、需安装）、[TinyHelpers](https://tiny-helpers.dev/)（链接聚合而非直接工具）形成差异。我们的定位是：**零安装、零学习、打开即用**，以中文开发者为主要受众。

## Anti-references

- 强制登录才能使用工具的网站
- 多步引导、弹窗广告、功能藏得深的工具站
- 过度装饰、动画堆砌的 SaaS 模板风
- 任何让用户等待的东西（加载画面、注册流程、多余点击）

## Design Principles

> 具体的 UI 规则和视觉规范见 DESIGN.md。本节只定义产品行为原则。

- **即开即用**：打开页面就是工具本身，零步骤直达核心功能。页面加载后主输入框自动聚焦，用户可以直接开始输入。
- **结果即时**：纯计算类工具输入即输出，不需要点击"运行"按钮。耗时操作（如大文件哈希）实时显示进度，不阻塞 UI。
- **轻量到极致**：页面加载快、JS 体积小、不引入重型依赖。单工具页 JS 应控制在 50KB 以内（gzip 后）。
- **值得信赖**：客户端运算，无数据上传，用户清楚知道发生了什么。所有数据处理在浏览器本地完成。

## Tool Categories

工具按功能分组，每组一个 URL 前缀，侧边栏按分组展示。

| 分类 | URL 前缀 | 已有工具 |
|------|----------|----------|
| 编码转换 | `/encoding/` | Base64 编解码、URL 编解码、JWT 编解码 |
| 加密哈希 | `/crypto/` | 哈希生成器、对称加解密 |
| 日期时间 | `/datetime/` | 日期时间转换器 |
| 文本处理 | `/text/` | UUID 生成器、随机字符串生成 |
| 网络工具 | `/network/` | 设备信息与 UserAgent |
| 格式化 | `/format/` | — |
| 正则工具 | `/regex/` | — |
| 颜色工具 | `/color/` | — |
| CSS 工具 | `/css/` | — |
| API 工具 | `/api/` | — |

> 工具注册表位于 `src/data/tools.ts`，本表应与其保持同步。

## URL Strategy

- 路由采用 kebab-case，语义化命名：`/encoding/base64`、`/datetime/datetime-converter`
- 分类前缀 + 工具名，形成 `/category/tool-name` 的二级结构
- 每个工具页面有独立的 `<title>` 和 meta description，便于 SEO

## Error Handling

- **输入校验错误**：在输入框下方以 `text-error` 内联显示具体中文错误描述，不用弹窗
- **操作成功反馈**：复制等操作通过 Toast 通知确认，持续 1.5s 后自动消失
- **运行时异常**：工具内部运算出错时，在输出区域显示友好的错误提示，附带错误原因（如"正则表达式语法错误"），不暴露技术堆栈

## Browser Support

| 浏览器 | 最低版本 | 备注 |
|--------|---------|------|
| Chrome | 90+ | Web Crypto API、Clipboard API |
| Firefox | 90+ | 同上 |
| Safari | 15+ | ES2020 特性 |
| Edge | 90+ | Chromium 内核，与 Chrome 对齐 |

不支持 IE 11。不要求安装任何浏览器扩展。

## Internationalization

当前为**单语言（简体中文）项目**，界面文案、错误提示、工具描述均为中文。如需多语言支持，应在 PRODUCT.md 中明确声明目标语言后再启动国际化改造。

## Performance Baselines

| 指标 | 目标值 |
|------|--------|
| Lighthouse Performance | ≥ 90 |
| LCP（Largest Contentful Paint） | < 1.5s |
| CLS（Cumulative Layout Shift） | < 0.1 |
| 单工具页 JS 体积（gzip） | < 50KB |
| 首页 JS 体积（gzip） | < 100KB |

## Accessibility

遵循 WCAG 2.1 AA 标准。具体要求：

- **键盘导航**：所有交互元素可通过 Tab 访问，焦点顺序符合逻辑，当前焦点元素有明确的视觉指示（`focus:border-accent`）
- **表单标签**：每个输入框有关联的 `<label>` 或 `aria-label`，错误消息通过 `aria-describedby` 关联到输入框
- **颜色对比度**：正文文字与背景的对比度不低于 4.5:1（`#1a1a1a` on `#faf9f7` ≈ 16:1 ✓）
- **动效偏好**：尊重 `prefers-reduced-motion`，在该偏好下所有 transition 设为 `0ms`
- **非视觉反馈**：复制成功/失败通过 `aria-live="polite"` 区域播报，不依赖颜色变化传达信息
- **Landmark 角色**：侧边栏使用 `<nav>`，主内容区使用 `<main>`，工具卡片标题使用 `<h2>` 层级
