# CopyButton 统一 redesign

## 1. 背景与目标

当前全站复制按钮存在两种形态：

1. `CopyButton.vue` 是文字按钮，显示「复制」→ 点击后变成「✓ 已复制」，同时触发全局 Toast。
2. `CodePanel.vue` 内部已是图标按钮，但同样会触发 Toast。
3. `UuidGenerator`、`RandomStringGenerator` 等工具各自维护复制逻辑；`FileToBase64` 因有大文件前置提示和自定义失败文案，保持独立复制逻辑。

这种分散实现导致：

- 视觉风格不一致（文字按钮 vs 图标按钮）。
- 复制反馈方式不一致（有的 Toast、有的图标变化）。
- 同一套复制状态管理在多处重复实现。

**目标**：把全站复制按钮统一为图标按钮，点击后图标变为 ✓，1.5 秒后恢复；复制成功不弹 Toast；复制失败才弹 Toast 提示。

## 2. 设计决策

| 决策 | 内容 | 理由 |
|------|------|------|
| 按钮形态 | 纯图标按钮，无文字 | 符合现代工具站风格，减少视觉噪音 |
| 成功反馈 | 图标切换为 ✓，1.5s 后恢复，不弹 Toast | 用户已看到即时视觉反馈，无需额外弹窗打扰 |
| 失败反馈 | 图标不变，Toast 提示 `'复制失败，请重试'` | 失败时需要明确告知用户 |
| 实现方式 | 提取 `useCopy` composable，`CopyButton` 和 `CodePanel` 共用 | 逻辑集中，行为一致，便于后续维护 |
| 图标来源 | 内联 SVG，不引入图标库 | 与项目现有实现保持一致，减少依赖 |

## 3. 组件 API

### 3.1 `useCopy` composable

路径：`src/composables/useCopy.ts`

```ts
export interface UseCopyOptions {
  /** 复制成功后状态保持时长，默认 1500ms */
  duration?: number;
}

export interface UseCopyResult {
  /** 是否处于"已复制"确认态 */
  copied: Ref<boolean>;
  /** 触发复制 */
  copy: (text: string) => Promise<void>;
}

export function useCopy(options?: UseCopyOptions): UseCopyResult;
```

行为：

- 空字符串直接返回，不触发任何反馈。
- 调用现有 `copyToClipboard(text)`。
- 成功时 `copied.value = true`，持续 `duration` 后自动复位；每次调用都重置计时器，避免多次点击导致提前恢复。
- 失败时 `copied` 保持 `false`，dispatch `toast` event，message 为 `'复制失败，请重试'`。
- 返回 `Promise<boolean>` 供调用方在需要时覆盖默认失败反馈（如 `FileToBase64` 大文件场景可提示"建议下载 .txt"）。

### 3.2 `CopyButton.vue`

路径：`src/components/ui/CopyButton.vue`

Props：

```ts
interface Props {
  /** 要复制的文本 */
  text: string;
  /** 按钮尺寸，默认 md */
  size?: 'sm' | 'md';
}
```

变化：

- 移除旧的 `label?: string` prop。
- 新增可选 `size` prop。

## 4. 视觉规范

沿用 `CodePanel` 当前图标按钮风格，并作为 `CopyButton` 默认外观。

### 4.1 默认态

```
w-9 h-9
flex items-center justify-center
rounded-sm
border border-border
bg-card text-muted
transition-[background-color,border-color,color] duration-150
hover:bg-hover hover:text-text
disabled:opacity-50 disabled:cursor-not-allowed
```

- 尺寸：36×36（md）
- 图标：16×16
- 圆角：4px

### 4.2 成功态

```
border-success text-success bg-card
```

1.5 秒后自动恢复默认态。

### 4.3 失败态

保持默认态不变，仅通过 Toast 反馈。

### 4.4 尺寸变体

| 变体 | 按钮尺寸 | 图标尺寸 |
|------|---------|---------|
| md（默认） | 36×36 | 16×16 |
| sm | 28×28 | 14×14 |

### 4.5 SVG 图标

复制图标：两个重叠矩形（Lucide `copy` 风格）。
已复制图标：对勾 `polyline points="20 6 9 17 4 12"`。

## 5. 行为规则

1. 空内容或 `disabled` 时按钮不可点击。
2. 点击后立即执行复制。
3. 成功：图标变 ✓；1.5s 后恢复；不弹 Toast。
4. 失败：图标不变；弹 Toast `'复制失败，请重试'`。
5. 快速连续点击：每次点击重新计时 1.5s。
6. 尊重 `prefers-reduced-motion`：系统已全局把 transition duration 设为 0ms，本组件继承即可。

## 6. 迁移范围

### 6.1 核心改动

| 文件 | 改动 |
|------|------|
| `src/composables/useCopy.ts` | 新建 |
| `src/components/ui/CopyButton.vue` | 改为图标按钮，使用 `useCopy`，移除 `label` prop |
| `src/components/ui/CodePanel.vue` | 内部复制逻辑改用 `useCopy`，移除重复实现 |

### 6.2 移除 `label` prop 的使用方

这些文件只需删除 `<CopyButton>` 上的 `label` prop（部分带自定义 class 也一并清理）：

- `src/tools/encoding/UrlEncodeCodec.vue`
- `src/tools/encoding/JwtParser.vue`
- `src/tools/encoding/Base64ToImage.vue`
- `src/tools/crypto/HashGenerator.vue`
- `src/tools/network/HttpStatusCodes.vue`
- `src/tools/network/DeviceInfo.vue`
- `src/tools/datetime/DateTimeConverter.vue`（同时移除 `class="px-2 py-1 text-xs shrink-0"`）

### 6.3 自定义复制逻辑收敛

这些文件直接调用 `navigator.clipboard.writeText` 并自己触发 Toast，需要改用 `useCopy` 或 `CopyButton`：

- `src/tools/text/UuidGenerator.vue`（`copySingle`、`copyAll`）
- `src/tools/text/RandomStringGenerator.vue`（单条复制、复制全部）

`FileToBase64.vue` 因有大文件前置提示和自定义失败文案，保持现有独立复制逻辑，不纳入本次统一。

## 7. 已知副作用与注意事项

1. `DateTimeConverter.vue` 当前给 `<CopyButton>` 加了 `class="px-2 py-1 text-xs shrink-0"`，改造为图标按钮后这些样式不再需要，会一并清理。
2. 所有 `label` prop 删除后，原来依赖文案长度撑开布局的地方需要检查是否会出现按钮过窄的情况；图标按钮固定宽高，一般不影响。
3. 失败 Toast 文案统一为 `'复制失败，请重试'`，不再区分权限/非 HTTPS/剪贴板 API 不可用等具体原因。

## 8. 验收标准

- [ ] 全站所有复制按钮外观一致，均为图标按钮。
- [ ] 点击复制成功后图标变为 ✓，1.5s 后恢复，不触发 Toast。
- [ ] 复制失败时图标不变，触发 Toast 错误提示。
- [ ] `CopyButton.vue` 和 `CodePanel.vue` 共用同一套 `useCopy` 逻辑。
- [ ] `UuidGenerator`、`RandomStringGenerator` 不再直接调用 `navigator.clipboard.writeText`。
- [ ] 构建通过，无 TypeScript 错误。
