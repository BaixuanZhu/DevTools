# Design — PC 端 Header 高频工具快捷入口

## 数据流

```
src/data/quick-links.ts          QUICK_LINK_TOOL_IDS: string[]（有序精选 id）
src/data/tools.ts                getToolById(id)（已有）
          │ layouts 解析（server 端，序列化体积最小）
          ▼
Layout.astro / ToolLayout.astro  quickLinks={getQuickLinkTools()}
          ▼ prop: { id, path, name, icon }[]
Shell.vue                        <nav aria-label="常用工具"> 渲染激活态
```

- `quick-links.ts` 导出 `getQuickLinkTools(): Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon'>[]`：
  按 QUICK_LINK_TOOL_IDS 顺序查 `getToolById`，查不到跳过 + `import.meta.env.DEV` 时 console.warn。
  （与 AGENTS.md「data/ 目录放注册表类数据」一致，解析逻辑与数据同文件，layouts 只调用。）

## Shell.vue 布局改动

Header 三段式：左（现状不动）+ **中（新增）** + 右（现状不动）。

```html
<header class="... 现状保留">
  <div class="flex items-center gap-4">…logo…</div>
  <!-- 新增：快捷入口，lg 以下不渲染 -->
  <nav v-if="quickLinks.length" aria-label="常用工具"
       class="hidden lg:flex items-center gap-1 min-w-0 mx-4">
    <a v-for="t in quickLinks" :key="t.id" :href="t.path"
       class="flex items-center gap-1.5 px-2 py-1 rounded-sm text-sm whitespace-nowrap
              transition-[background-color,color] duration-150 hover:bg-accent focus:outline-none"
       :class="currentPath === t.path ? 'text-primary' : 'text-foreground'">
      <span class="text-base shrink-0" aria-hidden="true">{{ t.icon }}</span>
      {{ t.name }}
    </a>
  </nav>
  <div class="flex items-center gap-3 ml-auto">…右侧现状…</div>
</header>
```

要点：

- Header 是 `justify-between` 三子元素：中间 nav 自然居中偏左；右侧组加 `ml-auto` 保证贴右。
- `whitespace-nowrap` 防止工具名换行；`min-w-0` 防溢出撑破。
- 激活态 = Sidebar 激活分类同款 `bg-accent text-primary font-medium`（评审后修正：实现期发现暗色主题下 `--primary` 与 `--foreground` 均近白，仅 `text-primary` 不可辨；与 Sidebar 激活态保持一致同时解决双主题可辨性与全局一致性）。
- Props 新增 `quickLinks?: QuickLinkTool[]`，默认 `[]`（向后兼容既有测试与潜在调用方）。

## 宽度预算（lg = 1024px）

| 段 | 估算 |
|----|------|
| px-6 × 2 | 48px |
| Logo（图标 24 + 文本 ~90 + gap） | ~140px |
| 右侧（主题 36 + Gitee 24 + GitHub 24 + gap-3×2） | ~110px |
| 可用中部 | ~726px |
| 5 个入口（icon 20 + 名称 2~6 字 ≈ 30~90 + px-2×2） | ~330~600px |

余量充足；若未来清单加长，靠 `quick-links.ts` 数量约束（≤6）控制。

## 精选清单首发（以 tools.ts 实际 id 为准）

`json-formatter`、`base64`、`image-converter`、`datetime-converter`、`tester`。
理由：覆盖格式化、编解码、图片处理、时间戳、正则五类最高频场景；顺序按使用频次预估。

## 兼容性 / 回滚

- 纯增量 UI：不动 Sidebar、搜索、主题逻辑；`quickLinks` 缺省 [] 时行为与旧版一致。
- 回滚点：删除 nav 节点 + layouts 的 prop 传递即可，无状态迁移。

## 测试设计（happy-dom，扩展现有 Shell.test.ts）

1. 传入 3 项 quickLinks → nav 渲染 3 个 `<a>`，顺序与文本/ href 正确。
2. `currentPath` 命中某项 → 该项 class 含 `text-primary`，其余不含。
3. `currentPath: '/'` → 无 `text-primary` 激活项。
4. `quickLinks` 缺省 → nav 不渲染（v-if），既有用例不破坏。
5. <lg 断点隐藏为 CSS 行为（`hidden lg:flex` 类断言 class 存在即可）。
