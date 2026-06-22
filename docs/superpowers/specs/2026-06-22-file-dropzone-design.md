# FileDropzone 可复用文件选择组件设计

## 背景

当前项目中，8 个工具、10 处文件选择点都在重复实现隐藏 input、拖拽高亮、粘贴监听、文件校验等相同逻辑。`ImageScrambler.vue` 还存在一个体验问题：选择图片后，必须点击「清空」才能重新选择同一文件，因为原生 `<input type="file">` 的 `value` 未被重置。

## 目标

1. 解决 `ImageScrambler.vue` 必须清空才能重选的问题。
2. 沉淀一个可复用的 `FileDropzone.vue` 组件，供后续工具逐步替换手写文件选择逻辑。
3. 不引入新依赖，保持浏览器原生能力。

## 设计原则

- **职责单一**：组件只负责「让用户把文件交出来」和「内置清除入口」，不处理文件解码、预览 URL 生成等业务逻辑。
- **受控组件**：通过 `modelValue` + `update:modelValue` 与调用方同步状态。
- **零新依赖**：基于原生 `<input type="file">`、拖拽事件、`clipboardData` 实现。
- **视觉一致**：严格使用 DESIGN.md 定义的设计令牌（`border-border`、`border-accent`、`bg-hover` 等）。

## 组件规格

### 文件位置

`src/components/ui/FileDropzone.vue`

### Props

```ts
interface Props {
  /** 当前已选文件（受控） */
  modelValue?: File | null;
  /** accept 属性，与原生 input 一致，如 "image/*" 或 ".json" */
  accept?: string;
  /** 文件大小上限（字节），0 表示不限 */
  maxSize?: number;
  /** 是否启用拖拽（默认 true） */
  enableDrag?: boolean;
  /** 是否监听全局 paste 事件（默认 false） */
  enablePaste?: boolean;
  /** 是否显示内置删除 ICON（默认 true） */
  clearable?: boolean;
}
```

### Emits

```ts
interface Emits {
  'update:modelValue': [file: File | null];
  /** 用户通过点击、拖拽、粘贴选中有效文件时触发 */
  select: [file: File];
  /** 点击内置删除 ICON 时触发 */
  clear: [];
  /** 校验失败时触发，消息为中文 */
  error: [message: string];
}
```

### Slots

- `default`：拖拽/点击区域的内容。调用方完全控制空态与有文件态的展示，slot 内部可覆盖最小高度等样式。

### 视觉

- 外框：`border-2 border-dashed rounded-lg`
- 默认状态：`border-border hover:border-accent`
- 拖拽悬停状态：`border-accent bg-hover`
- 最小高度：`min-h-[400px]`
- 删除 ICON：当 `clearable && modelValue` 时，显示在区域右上角，样式与现有 `ClearButton` 一致

### 行为

1. **点击选择**
   - 重置隐藏 `<input type="file">` 的 `value = ''`。
   - 调用 `input.click()`。
   - `change` 触发后校验并 emit `select` 与 `update:modelValue`。

2. **拖拽**
   - 监听 `dragover` / `dragleave` / `drop`。
   - 维护内部 `isDragging` 状态用于视觉高亮。
   - 取 `dataTransfer.files[0]`，校验后抛出。

3. **粘贴**
   - 仅当 `enablePaste` 为 true 时，在 `onMounted` 注册全局 `paste` 监听，在 `onUnmounted` 移除。
   - 从 `clipboardData.items` 中查找文件类型项，通过 `getAsFile()` 获取文件。

4. **校验**
   - `accept`：先交给原生 input 过滤，再做兜底校验（`file.type` 或扩展名）。
   - `maxSize`：超出时 emit `error('文件过大（...），超过 ... 上限')`。
   - 未识别到文件时 emit `error`。

5. **清除**
   - 点击删除 ICON 后 emit `update:modelValue(null)` 与 `clear`。
   - 调用方负责清理业务状态（如 object URL、ImageData 等）。

## ImageScrambler.vue 集成方案

### 变更点

1. 删除：
   - `fileInputRef`、`isDragging`
   - 隐藏 `<input type="file">`
   - 原空态上传区 `<div>` 与拖拽/粘贴事件
   - 顶部操作区的 `ClearButton`

2. 新增：
   - `const selectedFile = ref<File | null>(null);`
   - 使用 `FileDropzone` 包裹图片展示区域：
     ```vue
     <FileDropzone
       v-model="selectedFile"
       accept="image/*"
       :max-size="FILE_SIZE_LIMIT"
       enable-drag
       enable-paste
       clearable
       @select="(f) => void processFile(f)"
       @clear="handleClear"
       @error="(msg) => errorMsg = msg"
     >
       <template #default>
         <div v-if="!displayUrl" class="flex flex-col items-center justify-center">
           <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
           <div class="text-xs text-muted mt-1">支持任意图片格式，上限 50MB</div>
         </div>
         <div v-else>
           <!-- 保留原有图片展示、状态标签、尺寸对比 -->
         </div>
       </template>
     </FileDropzone>
     ```

3. `handleClear()` 逻辑保持不变，由 FileDropzone 的 `@clear` 触发。

### 效果

- 用户随时点击上传区即可重新选择图片，包括同一张图片。
- 清空入口从顶部操作区移入上传区右上角，更符合直觉。
- 拖拽、粘贴行为与原有逻辑一致。

## 测试策略

- **单元测试**：新增 `src/components/ui/__tests__/FileDropzone.test.ts`，覆盖点击触发、accept 过滤、maxSize 超限、拖拽文件、粘贴文件、清除事件。
- **手动验证**：在 `/media/image-scrambler` 验证相同文件重选、取消后再选、拖拽、粘贴、清空后重新选择。
- **构建检查**：运行 `pnpm astro check` 与 `pnpm build`，确保类型与构建通过。

## 后续扩展

该组件设计为通用基础组件，后续可逐步替换以下工具中的手写文件选择逻辑：

- `src/tools/media/ImageConverter.vue`
- `src/tools/media/QrCodeReader.vue`
- `src/tools/encoding/FileToBase64.vue`
- `src/tools/encoding/Base64ToImage.vue`
- `src/tools/encoding/Base64ToFile.vue`
- `src/tools/crypto/HashGenerator.vue`
- `src/tools/format/JsonFormatter.vue`
- `src/tools/format/JsonDiff.vue`

替换时只需迁移 props 与 slot 内容，业务处理逻辑保持不动。

## 决策记录

- **不自封装 renderless composable**：用户明确希望沉淀可复用组件，且组件自带统一视觉。
- **不引入开源文件选择库**：项目为浏览器端、无后端，功能完全可由原生 API 实现；引入第三方库会带来样式冲突、包体积增加和依赖维护成本。
- **组件不内置文件预览**：各工具的预览/展示方式差异大（图片、文本、哈希值等），由调用方通过 slot 控制更灵活。
- **最小高度 400px**：与现有 `ImageScrambler.vue` 上传区高度保持一致。
