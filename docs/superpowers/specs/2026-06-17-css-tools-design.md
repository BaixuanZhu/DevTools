# CSS 工具（单位转换器 + 渐变生成器）设计文档

> P2 前端高频补全阶段中「CSS 工具」分类的首批两个独立工具：CSS 单位转换器与 CSS 渐变生成器。两者均为纯浏览器端计算，无后端，无第三方库。
>
> - **创建日期**：2026-06-17
> - **来源**：`docs/ROADMAP.md` §P2 · 前端高频补全
> - **预估工时**：5 人天（UI + 逻辑 + SEO + 自测；单位转换器 2d + 渐变生成器 3d）
> - **状态**：设计定稿，待实现

---

## 一、定位与命名

### 1.1 工具清单

| 显示名 `name` | 工具 ID `id` | 路由 `path` | 分类 | 图标 |
|---|---|---|---|---|
| CSS 单位转换器 | `unit-converter` | `/css/unit-converter` | CSS 工具（`css`，新建分类） | 📐 |
| CSS 渐变生成器 | `gradient` | `/css/gradient` | CSS 工具（`css`） | 🌈 |

> **约束**：`id` 必须等于 `path` 末段，否则 FAQ / 相关工具 / SEO 结构化数据会静默失效（参见项目记忆 `tool-id-must-match-path-slug`）。

### 1.2 命名说明

- **CSS 单位转换器**：直接点明能力，用户搜索「px 转 rem」「vw 换算」等关键词时语义清晰。
- **CSS 渐变生成器**：聚焦「渐变」这一高频视觉需求，避免 ROADMAP 原方案「渐变与阴影」把两种不同心智任务硬凑的问题。

---

## 二、范围

### 2.1 做

**CSS 单位转换器**

1. 支持 px / rem / em / vw / vh / % / pt 七种单位实时互转。
2. 可配置根字号（默认 16px）、设计稿宽度（默认 375px）、视口高度（默认 812px）。
3. 修改任意单位输入框，其他单位实时联动；最后编辑的单位作为计算源。
4. 一键复制全部转换结果。

**CSS 渐变生成器**

1. 支持线性（linear）、径向（radial）、圆锥（conic）三种渐变类型。
2. 可视化色标编辑：轨道拖动调整位置、点击轨道空白处新增色标、双击/删除按钮移除色标。
3. 类型专属参数：线性角度、径向形状与中心点、圆锥起始角度与中心点。
4. 提供 3 组预设渐变（日落、海洋、霓虹）。
5. 实时预览与生成的 CSS 代码一键复制。

### 2.2 不做（YAGNI，记入排除项）

- **重复渐变（repeating-*）**：使用率不高，可通过多色标近似模拟。
- **阴影生成器**：已从本批次移除，避免与渐变混为一谈；未来若需可单独建工具。
- **复杂径向渐变大小关键字**：如 `closest-side`、`farthest-corner` 等，第一版仅支持默认大小。
- **导出为图片**：超出当前范围，Canvas 截图非刚需。
- **历史记录 / 收藏**：项目全局未引入状态库，暂不做。

---

## 三、架构与模块拆分

两个工具均为「Astro 页面壳 + Vue 交互组件 + 纯函数工具库」三层结构，对齐项目现有工具模式。

```
src/
├── pages/css/
│   ├── unit-converter.astro      # /css/unit-converter
│   └── gradient.astro            # /css/gradient
├── tools/css/
│   ├── CssUnitConverter.vue      # 单位转换器交互组件
│   └── CssGradientGenerator.vue  # 渐变生成器交互组件
├── utils/css/
│   ├── unit-converter.ts         # 单位转换计算函数 + __tests__/unit-converter.test.ts
│   └── gradient.ts               # 渐变解析/生成/CSS 输出函数 + __tests__/gradient.test.ts
├── data/
│   ├── tools.ts                  # 新建 /css 分类 + 注册两个工具
│   └── tool-faqs.ts              # 各补充 2–3 条 FAQ
└── components/ui/                # 复用 CopyButton 等现有组件
```

### 3.1 技术约束

- **纯本地计算**：无 Web Worker，计算量极小。
- **无第三方库**：渐变拖动、颜色解析均用原生 API / 正则实现。
- **安全规则**：不引入 `eval()` 或 `Function()`；正则操作包裹 `try-catch`。
- **跨框架通知**：复制成功/失败通过 `CustomEvent('toast')` 触发 Alpine Toast。

---

## 四、CSS 单位转换器详细设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────┐
│  CSS 单位转换器                              │
│  px / rem / em / vw / vh / % / pt 实时互转  │
├─────────────────────────────────────────────┤
│  基准设置                                     │
│  根字号: [16] px   设计稿宽度: [375] px      │
│  视口高度: [812] px                          │
├─────────────────────────────────────────────┤
│  转换输入（修改任意一个，其余联动）           │
│  px     [16]                                 │
│  rem    [1]                                  │
│  em     [1]                                  │
│  vw     [4.2667]                             │
│  vh     [1.9704]                             │
│  %      [100]                                │
│  pt     [12]                                 │
├─────────────────────────────────────────────┤
│  [清空]              [复制全部结果]           │
└─────────────────────────────────────────────┘
```

### 4.2 核心状态

```ts
type UnitKey = 'px' | 'rem' | 'em' | 'vw' | 'vh' | 'pct' | 'pt';

const rootFontSize = ref(16);
const designWidth = ref(375);
const viewportHeight = ref(812);
const lastEditedUnit = ref<UnitKey>('px');
const values = reactive<Record<UnitKey, string>>({
  px: '16',
  rem: '1',
  em: '1',
  vw: '4.2667',
  vh: '1.9704',
  pct: '100',
  pt: '12',
});
```

### 4.3 转换规则

- 所有单位先归一化为 **px**，再由 px 派生其他单位。
- `px → rem`：`px / rootFontSize`
- `px → em`：本工具按根 em 语义处理，`em === rem`（符合开发者最常用场景）。
- `px → vw`：`px / designWidth * 100`
- `px → vh`：`px / viewportHeight * 100`
- `px → %`：`px / rootFontSize * 100`
- `px → pt`：`px * 0.75`

### 4.4 交互规则

1. 页面加载时给出默认值 `16px`，其余单位自动计算显示。
2. 用户修改任意输入框：
   - 该单位成为 `lastEditedUnit`；
   - 实时转换为 px；
   - 其他单位立即重新计算；
   - 非法输入时当前框标红，其余框显示 `—`。
3. 修改根字号/设计稿宽度/视口高度后，以 `lastEditedUnit` 为源重新计算全部结果。

### 4.5 输出格式

- 数值保留 **4 位有效小数**，自动去掉末尾多余的 0。
- 复制全部结果输出多行文本，例如：

```
16px = 1rem
16px = 1em
16px = 4.2667vw
16px = 1.9704vh
16px = 100%
16px = 12pt
```

### 4.6 错误处理

- 输入非数字或负数：内联提示「请输入有效数字」。
- 根字号/设计稿宽度/视口高度为 0 或空：提示「基准值必须大于 0」。

---

## 五、CSS 渐变生成器详细设计

### 5.1 页面布局

```
┌─────────────────────────────────────────────┐
│  CSS 渐变生成器                              │
│  可视化创建 linear / radial / conic 渐变     │
├─────────────────────────────────────────────┤
│  类型: [线性 ▼]  角度: [90°]                │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │          渐变预览区域                │    │
│  │         (实时渲染)                   │    │
│  └─────────────────────────────────────┘    │
│  ●─────●────────●─────────────────────────●  │
│  (色标轨道，可拖动/新增/删除)                 │
├─────────────────────────────────────────────┤
│  当前色标: 颜色 [🎨]  位置 [0%]  [删除]      │
├─────────────────────────────────────────────┤
│  预设: [日落] [海洋] [霓虹]                  │
├─────────────────────────────────────────────┤
│  生成的 CSS                                  │
│  linear-gradient(90deg, #ff0000, #0000ff)   │
├─────────────────────────────────────────────┤
│  [清空]              [复制 CSS]              │
└─────────────────────────────────────────────┘
```

### 5.2 核心状态

```ts
type GradientType = 'linear' | 'radial' | 'conic';

interface ColorStop {
  id: string;
  color: string;
  position: number; // 0–100
}

const type = ref<GradientType>('linear');
const angle = ref(90);
const centerX = ref(50);
const centerY = ref(50);
const shape = ref<'circle' | 'ellipse'>('ellipse');
const stops = ref<ColorStop[]>([
  { id: '1', color: '#ff7e5f', position: 0 },
  { id: '2', color: '#feb47b', position: 100 },
]);
const activeStopId = ref<string>('1');
```

### 5.3 色标可视化编辑

- **拖动**：在色标轨道内按下色标并拖动，实时更新 `position`（限制 0–100）。
- **新增**：点击轨道空白处，在点击位置插入新色标，颜色取相邻两色标的中间色或默认 `#808080`。
- **删除**：选中色标后点击删除按钮；至少保留 2 个色标，低于 2 个时禁用删除。
- **选中**：点击色标即选中，下方显示颜色选择器与位置输入框，支持精确调整。

### 5.4 类型专属参数

| 类型 | 可调参数 |
|---|---|
| 线性（linear） | 角度滑杆 0–360° |
| 径向（radial） | 形状 `circle` / `ellipse`、中心点 X/Y |
| 圆锥（conic） | 起始角度 0–360°、中心点 X/Y |

### 5.5 生成的 CSS

```css
linear-gradient(90deg, #ff7e5f 0%, #feb47b 100%)
radial-gradient(ellipse at 50% 50%, #ff7e5f 0%, #feb47b 100%)
conic-gradient(from 90deg at 50% 50%, #ff7e5f 0%, #feb47b 100%)
```

色标按 `position` 排序后生成；相邻色标位置相同时保留原始顺序。

### 5.6 预设渐变

| 名称 | 类型 | 色标 |
|---|---|---|
| 日落 | linear | `#ff7e5f → #feb47b` |
| 海洋 | linear | `#2193b0 → #6dd5ed` |
| 霓虹 | linear | `#f857a6 → #ff5858` |

点击预设时替换 `stops`，`type` 保持线性，角度保留当前值。

### 5.7 错误处理

- 颜色解析失败：使用 `#000000` 兜底，并在输入框下方提示「颜色格式无效」。
- 只剩 2 个色标时禁用删除按钮。
- 生成的 CSS 实时更新，无需手动触发。

---

## 六、数据流、错误处理与测试

### 6.1 数据流

两个工具均遵循「单一数据源 + 派生计算」：

- **单位转换器**：`lastEditedUnit` + `values[lastEditedUnit]` 为源，其他单位由 `unit-converter.ts` 纯函数派生。
- **渐变生成器**：`type` + `angle/centerX/centerY/shape` + `stops` 为源，CSS 字符串与预览样式由 `gradient.ts` 纯函数派生。

### 6.2 错误处理

- 所有用户输入格式校验前置；
- 错误信息用中文内联展示；
- 复制成功/失败通过 `CustomEvent('toast')` 触发全局 Toast。

### 6.3 测试覆盖

每个工具函数文件配套 `__tests__/*.test.ts`：

- `unit-converter.test.ts`：七种单位互转、基准值变化、非法输入处理、边界值。
- `gradient.test.ts`：三种渐变 CSS 生成、色标排序、重复位置、颜色解析兜底。

---

## 七、SEO、工具注册与 FAQ

### 7.1 分类注册

在 `src/data/tools.ts` 中新增 `/css/` 分类：

```ts
{
  id: 'css',
  name: 'CSS 工具',
  path: '/css',
  description: 'CSS 单位、渐变、阴影等前端样式辅助工具',
}
```

### 7.2 工具注册

| toolId | name | description | keywords |
|---|---|---|---|
| `css/unit-converter` | CSS 单位转换器 | px/rem/em/vw/vh 等 CSS 长度单位实时互转 | px转rem, rem转px, vw换算, css单位转换, em换算, pt换算 |
| `css/gradient` | CSS 渐变生成器 | 可视化创建线性/径向/圆锥渐变并复制 CSS 代码 | css渐变生成器, linear-gradient, radial-gradient, conic-gradient, 渐变代码 |

### 7.3 FAQ

**CSS 单位转换器**

- Q: `em` 和 `rem` 有什么区别？
  A: 本工具按根 em 语义处理（`em === rem`）。实际项目中 `em` 可能相对于父元素字体大小。
- Q: `vw` 和 `vh` 基于什么尺寸计算？
  A: 基于页面顶部填写的「设计稿宽度」和「视口高度」，默认分别为 375px 和 812px。

**CSS 渐变生成器**

- Q: 支持重复渐变吗？
  A: 当前版本不支持，可通过添加多个色标模拟。
- Q: 圆锥渐变的浏览器兼容性如何？
  A: 圆锥渐变支持所有现代浏览器，但不支持 IE。

### 7.4 页面元信息

每个 `.astro` 页面通过 `ToolLayout` 自动注入 `<title>` 和 meta description，描述控制在 120–160 字符。

---

## 八、文件清单与工时

### 8.1 新增文件

| 文件 | 说明 |
|---|---|
| `src/pages/css/unit-converter.astro` | 单位转换器页面壳 |
| `src/pages/css/gradient.astro` | 渐变生成器页面壳 |
| `src/tools/css/CssUnitConverter.vue` | 单位转换器交互组件 |
| `src/tools/css/CssGradientGenerator.vue` | 渐变生成器交互组件 |
| `src/utils/css/unit-converter.ts` | 单位转换核心函数 |
| `src/utils/css/__tests__/unit-converter.test.ts` | 单位转换测试 |
| `src/utils/css/gradient.ts` | 渐变生成核心函数 |
| `src/utils/css/__tests__/gradient.test.ts` | 渐变生成测试 |

### 8.2 修改文件

| 文件 | 说明 |
|---|---|
| `src/data/tools.ts` | 新建 `/css` 分类，注册两个工具 |
| `src/data/tool-faqs.ts` | 添加两个工具共 4 条 FAQ |

### 8.3 工时估算

- CSS 单位转换器：2 人天
- CSS 渐变生成器：3 人天（色标拖动交互占主要时间）
- **合计：5 人天**

---

## 九、设计确认

本设计已通过用户分段确认：

- [x] 两个独立页面 + 新建 `/css` 分类
- [x] 单位转换器支持 px/rem/em/vw/vh/%/pt，主从联动
- [x] 渐变生成器支持线性/径向/圆锥，可视化拖动色标
- [x] 不支持重复渐变，提供 3 组预设
- [x] 数据流、错误处理、测试、SEO 方案
