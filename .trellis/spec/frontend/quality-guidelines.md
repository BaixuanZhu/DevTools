# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

无 ESLint/Prettier，质量靠三件套验证 + 代码审查。**每个任务收尾前必须全绿**：

```bash
pnpm test          # vitest 全量
pnpm astro check   # 类型门禁：0 errors
pnpm build         # 生产构建成功（当前 70 页）
```

全量测试允许存在的失败仅限"与本任务无关的既有失败"，新改动必须零新增失败。

---

## Forbidden Patterns

- **`eval()` / `Function()` / `setTimeout|setInterval(string)`** 处理用户输入，无例外（Security Rules 强制）
- **路径别名** `@/` `~/`（一律相对导入）
- **全局状态库**（Pinia 等）、**CustomEvent 字符串桥接**、自建 toast 队列（走 `toastStore`）
- **UI 原语绕过 reka-ui**（禁 @headlessui/vue 等）；shadcn-vue 组件从 `components/ui/` 取
- **Tailwind 任意值表达标准类可表达的值**：`w-[120px]`→`w-30`（4px 规则：像素/4）；允许的是设计令牌字号（`text-[0.8125rem]`）、非 4 倍数特殊值、自定义层级/阴影
- **新增依赖**：能用浏览器原生 API（Web Crypto、TextEncoder、URL）实现的不引库；同类不重复（有 dayjs 不引 moment）
- 逐参数注释写入 conf 产物、拖拽滑块数值控件等已否决形态（redis-config 任务结论）

---

## Required Patterns

- 公共类/接口/函数必须 JSDoc，只写代码本身无法表达的"为什么"；改代码必须同步改注释
- 用户输入运算前校验，错误提示**中文友好**（Tool Page Requirements）
- 工具页四件套：输入校验 + 清空/复制按钮 + 打开即用的合理默认值 + `tools.ts` SEO 全字段（FAQ 同步 `tool-faqs.ts`）
- 通知走 `toastStore`；复制走 `useCopy`/`CopyButton`
- 密码等敏感生成用 `crypto.getRandomValues` 纯本地，页面声明"数据不上传"

---

## Testing Requirements

### 布局与环境

- 单元测试与被测模块**同目录** `__tests__/`；分类集成测试 `src/tests/{category}/`
- vitest：`environment: 'node'` + `globals: true`（describe/it/expect 直接用）
- 组件测试文件顶部加 `// @vitest-environment happy-dom`

### 可测性结构（核心要求）

**数据与计算层禁止 import Vue**——纯函数引擎（`params/compute/generate/version`）不依赖组件即可全覆盖单测（范式：`redis-config/__tests__/` 6 个文件 100+ 用例）。组件只做绑定与展示，交互逻辑薄。

### 组件测试范式（`SelectListbox.test.ts`）

- reka-ui 触发器在 happy-dom 下用 `pointerdown` 打开（真实浏览器 click 一定生效），portal 内容查 `document.body`
- **afterEach 必须 unmount 全部实例**：popper 定位是异步更新，portal 残留 + 后续用例清空 body 会触发 `insertBefore` 空指针（未处理 rejection 导致整轮退出码非零）
- 选择类断言：选中项 `data-state=checked`；选项点击派发 `pointerup` 触发 emit

### 断言习惯

- 数据层不变量测试防回归（实例：`params.test.ts` 遍历断言"所有 select 选项值非空串"）
- conf 类产物用"打开即用"快照断言 + 分场景指令断言（`generate.test.ts`）

### 浏览器冒烟（agent-browser，三门全绿后仍必做）

单测证明逻辑正确，冒烟证明**水合后行为**正确（SSR 岛屿 hydration 后才有的问题单测测不到）。两条踩过的坑：

- **`AGENT_BROWSER_SESSION` 不跨命令持久**——每条 Bash 都是独立 shell，漏 export 会静默落回默认共享 session 的空白页：症状是 snapshot 有内容、`eval` 读到 `about:blank` / `document.body.textContent` 为空。每条命令都写全 `export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix task)" && ...`
- **本站壳层滚动在内部容器**——window 滚动 / fullPage 截图无效，须 `document.querySelectorAll('div.overflow-y-auto')[1].scrollTop = N`（第二个匹配才是滚动容器）
- 交互后读 Vue 渲染结果要异步等一拍再断言（同步读发生在响应式 flush 之前）；区分"conf 指令行"与"面板提示文案"用 `/^key\s*=/m` 而非 includes（废弃参数的替代提示文案里含新参数名）

---

## Code Review Checklist

- [ ] `pnpm test` / `pnpm astro check` / `pnpm build` 三绿
- [ ] 新增公共 API 有 JSDoc；注释与实现同步
- [ ] import 相对路径；无 any；无新增依赖（或已论证必要性）
- [ ] 间距 4px 规则；无违规任意值；暗色模式可用
- [ ] 用户输入有校验与中文错误提示；无 eval 类调用
- [ ] 新工具：注册表/FAQ/路由对称/水合策略（默认 `client:idle`）/私有组件未上浮
- [ ] 移动端基础可用（工具页纵向顺序经过设计，见 redis-config 布局结论）
