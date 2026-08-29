# 执行清单 — Redis 配置文件生成器

前置：`research/redis-params-version-notes.md` 已产出（后台研究代理）；实现前先通读，存疑项以官方文档人工复核。

## 步骤

### 1. 数据层（纯函数，先行且可独立验证）

- [ ] `src/tools/devops/redis-config/version.ts`：`VERSION_ORDER`、`isAvailable()`、版本下拉元数据
- [ ] `src/tools/devops/redis-config/params.ts`：11 组 ~55 参数定义（按 research 笔记核对 introducedIn/deprecatedIn/replacedBy/docUrl；每参数 compute + 中文注释）
- [ ] `src/tools/devops/redis-config/compute.ts`：场景/硬件公式（design.md §关键公式）
- [ ] `src/tools/devops/redis-config/generate.ts`：`generateConf()` 行数组渲染 + 序列化为文本
- [ ] `src/tools/devops/redis-config/sysctl.ts`：系统参数建议数据
- [ ] 单测 `__tests__/`：
  - compute：每个公式至少 2 组边界（小内存 vs 大内存、各场景、持久化开关）
  - version：7.0 上下过滤、废弃参数排除、replacedBy 提示数据
  - generate：默认画像快照/断言（打开即用产物合法性）、overrides 覆盖、单机无复制段
- [ ] **验证点 A**：`pnpm test redis-config` 全绿

### 2. UI 层（私有组件目录）

- [ ] `ScopeSlider.vue`（三段刻度 + 落点）→ `ParamRow.vue`（5 种控件分支 + 版本徽章 + 废弃提示 + 注释）→ `ControlPanel.vue`（画像/场景/版本/持久化/模式）→ `ConfigPreview.vue`（行号 + 高亮 + 操作条）→ `SysctlPanel.vue`
- [ ] `RedisConfigGenerator.vue` 主组件组装：`GenerateContext` 状态 + computed 渲染 + 主从联动 + 重置
- [ ] 样式：global.css 令牌、暗色适配、4px 间距规则；移动端纵向堆叠
- [ ] **验证点 B**：dev 服务器手动过一遍 PRD 功能需求 1-8

### 3. 注册与路由

- [ ] `src/data/tools.ts` 追加 ToolMeta（全字段，relatedToolIds 挂 env-converter/docker-run-helper）
- [ ] `src/data/tool-faqs.ts` 加 3-4 条 FAQ
- [ ] `src/pages/devops/redis-config-generator.astro`：ToolLayout + `client:idle`

### 4. 全量验证（对照验收标准）

- [ ] `pnpm build` / `pnpm test` / `pnpm astro check` 全绿
- [ ] PRD Acceptance Criteria 逐条勾验；暗色 + 移动端检查

## 验证命令

```bash
pnpm test redis-config   # 步骤 1 后
pnpm build && pnpm test && pnpm astro check   # 最终
```

## 回滚点

- 步骤 1 独立可回退（纯新增文件）
- 步骤 2 独立可回退
- 步骤 3 回退 = 还原 tools.ts/tool-faqs.ts 两处 diff + 删路由文件

## 风险与对策

- **参数版本标注错误** → 以 research 笔记为准，存疑项标注 TODO 在 PR 评审时人工核对官方文档
- **55 参数面板过长** → 分组 Collapsible 默认收起次要组；超出推荐范围的警示图标吸睛即可
- **client:idle 首帧空白** → 预览区加 skeleton 占位（纯 CSS）
