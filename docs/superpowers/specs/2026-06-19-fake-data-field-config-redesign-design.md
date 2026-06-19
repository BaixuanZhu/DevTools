# 假数据生成器字段配置区重设计

## 背景

当前 `src/tools/text/FakeDataGenerator.vue` 的字段配置区采用单行布局：

```
[列名 140px] [类型 flex-1] [删除]
[参数 flex-wrap ...]
```

在 `max-w-[720px]` 的约束下，存在以下问题：

1. **列名/类型/参数没有清晰对应关系**：参数行另起一行且左缩进，视觉上与字段行脱节。
2. **参数行拥挤**：`integer`/`decimal` 等有 2–3 个参数，标签+控件在 720px 内换行后显得杂乱。
3. **信息密度过高**：每行同时承载列名、类型下拉、删除和参数，阅读压力大。

## 目标

- 降低字段列表的视觉复杂度，让「列名 → 生成器类型」的对应关系一目了然。
- 将参数配置从行内迁移到 Dialog，释放横向空间。
- 宽度可放大以承载更舒展的字段行。
- Dialog 作为本地专用子组件实现，直接消费 `FieldConfig`，避免不必要的通用化抽象。

## 设计方案

采用 **方案 1：两行标签+按钮式 + 全功能 Dialog**。

### 1. 页面宽度

外层容器从 `max-w-[720px]` 改为 **`max-w-5xl`（1024px）**，保持单列垂直布局，不引入 `ResponsiveWorkspace`。

### 2. 字段行布局

每个字段占据一个列表项，内部两行：

- **第一行**：列名输入框 | 当前生成器类型标签 | 删除按钮
- **第二行**：「配置生成器」Ghost 文字按钮

字段之间用 `border-b border-border` 分隔，最后一项无边框。

#### 详细样式

| 元素 | 样式 |
|------|------|
| 列名输入框 | `flex-1 min-w-[160px]`，标准输入框样式，`placeholder="列名"` |
| 类型标签 | Chip 样式：`bg-hover text-text border border-border rounded-sm px-2 py-0.5 text-[0.8125rem]` |
| 删除按钮 | 图标按钮，同现有实现 |
| 配置按钮 | Ghost 文字按钮：`text-[0.8125rem] text-muted hover:text-text` |

### 3. Dialog 子组件

Dialog 作为 `FakeDataGenerator.vue` 的本地子组件实现（Vue 支持同文件内定义子组件），直接复用 `FieldConfig` 和 `FIELD_TYPE_OPTIONS`。

#### Props

```ts
interface Props {
  /** 控制 Dialog 显隐 */
  modelValue: boolean;
  /** 当前要编辑的字段配置（Dialog 内部深拷贝，不直接修改） */
  field: FieldConfig;
}
```

#### Emits

```ts
type Emits = {
  'update:modelValue': [boolean];
  save: [FieldConfig];
};
```

#### 内部结构

1. **标题**：`编辑「{field.name}」生成器`
2. **列名输入框**（可选，允许在 Dialog 内同步修改列名）
3. **类型选择**：使用 `SelectListbox` 组件
4. **参数表单**：根据当前类型的 `params` 动态渲染：
   - `number` → `<input type="number">`
   - `text` → `<input type="text">`
   - `select` → `SelectListbox`
5. **底部操作**：
   - 取消（Ghost 按钮）
   - 保存（Primary 按钮）

#### 类型切换行为

Dialog 内切换类型时，参数自动重置为新类型的默认值，与现有 `onTypeChange` 逻辑保持一致。

### 4. 数据流

```
FakeDataGenerator.vue
  ├─ fields: FieldConfig[]
  ├─ dialogOpen: boolean
  ├─ editingField: FieldConfig | null  // Dialog 内编辑的副本
  │
  ├─ 点击「配置生成器」
  │   └─ editingField = cloneDeep(field); dialogOpen = true
  │
  ├─ GeneratorConfigDialog
  │   └─ 用户编辑 type/params/name
  │
  └─ 点击保存
      └─ 用 editingField 替换 fields 中对应 rowId 的项
```

Dialog 内部必须持有字段配置的副本，避免取消时污染原数据。

### 5. 响应式

| 断点 | 行为 |
|------|------|
| ≥1024px | 内容区最大宽度 1024px，居中 |
| 768–1023px | 宽度自适应，保持两行布局 |
| <768px | 列名输入框占满可用宽度，类型标签与删除按钮不换行；Dialog 宽度接近屏幕宽度 |

### 6. 文件变更

- **修改**：`src/tools/text/FakeDataGenerator.vue`
  - 外层宽度改为 `max-w-5xl`
  - 字段行重构为两行
  - 移除行内参数表单
  - 新增本地 Dialog 子组件用于编辑字段类型与参数
- **不修改**：`src/utils/text/fake-data.ts`（字段类型元数据已满足需求）
- **不新增**：公共 UI 组件（本次 Dialog 不追求跨工具复用）

## 排除项

- 不在字段行显示参数摘要（避免格式不统一和换行问题）。
- 不引入 `ResponsiveWorkspace`。
- Dialog 内暂不做「上一个/下一个」字段切换，后续如需可扩展。
- 不增加新的字段类型或参数。

## 验证方式

1. 打开 `/text/fake-data-generator` 页面，字段配置区显示为两行。
2. 点击「配置生成器」，弹出 Dialog，可修改类型和参数。
3. 保存后字段列表的类型标签更新，生成结果符合新配置。
4. 取消后字段列表保持不变。
5. 在 <768px 宽度下布局不溢出。
