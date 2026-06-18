# CSS 渐变生成器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `/css/gradient` 页面，支持线性/径向/圆锥三种渐变的可视化创建、色标拖动编辑、预设渐变与 CSS 代码一键复制。

**Architecture:** 纯函数工具库 `src/utils/css/gradient.ts` 负责根据类型/参数/色标生成标准 CSS 渐变字符串；Vue 组件维护可视化状态（色标、角度、中心点、类型）并实现鼠标/触摸拖动；Astro 页面仅作为壳。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript + Tailwind CSS v4 + Vitest

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/css/gradient.ts` | 渐变纯函数：色标排序、CSS 字符串生成、颜色解析/格式化 |
| `src/utils/css/__tests__/gradient.test.ts` | 渐变生成单元测试 |
| `src/tools/css/CssGradientGenerator.vue` | 渐变生成器交互组件（含色标拖动） |
| `src/pages/css/gradient.astro` | `/css/gradient` 路由页面壳 |
| `src/data/tools.ts` | 注册 `css/gradient` 工具，更新 `unit-converter` 的 relatedToolIds |
| `src/data/tool-faqs.ts` | 添加 2 条 FAQ |

---

## Task 1: Create gradient generation utility

**Files:**
- Create: `src/utils/css/gradient.ts`

- [ ] **Step 1: Write the utility module**

```ts
/**
 * CSS 渐变生成工具模块。
 *
 * 负责根据渐变类型、参数和色标数组生成标准 CSS 渐变字符串。
 * 所有函数均为纯函数，可独立单元测试。
 */

/** 渐变类型 */
export type GradientType = 'linear' | 'radial' | 'conic';

/** 色标 */
export interface ColorStop {
  /** 唯一标识 */
  id: string;
  /** 颜色字符串（hex/rgb/hsl） */
  color: string;
  /** 位置 0–100 */
  position: number;
}

/** 径向形状 */
export type RadialShape = 'circle' | 'ellipse';

/** 渐变参数 */
export interface GradientOptions {
  type: GradientType;
  angle: number;
  centerX: number;
  centerY: number;
  shape: RadialShape;
  stops: ColorStop[];
}

/** 预设渐变 */
export interface GradientPreset {
  name: string;
  stops: ColorStop[];
}

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 钳制位置到 0–100 */
export function clampPosition(position: number): number {
  return Math.max(0, Math.min(100, position));
}

/** 将角度归一化到 0–360 */
export function normalizeAngle(angle: number): number {
  return ((((Math.round(angle) || 0) % 360) + 360) % 360);
}

/** 简单的 HEX / rgb / hsl 颜色正则校验（宽松） */
export function isValidColor(color: string): boolean {
  if (!color || typeof color !== 'string') return false;
  const trimmed = color.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return true;
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(trimmed)) return true;
  if (/^rgba\(/i.test(trimmed)) return true;
  if (/^hsl\(/i.test(trimmed)) return true;
  return false;
}

/** 兜底颜色 */
export const FALLBACK_COLOR = '#000000';

/** 规范化颜色（无效时返回兜底色） */
export function normalizeColor(color: string): string {
  return isValidColor(color) ? color.trim() : FALLBACK_COLOR;
}

/** 按 position 排序色标，相同位置保持原顺序 */
export function sortStops(stops: ColorStop[]): ColorStop[] {
  return [...stops].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return 0;
  });
}

/** 生成色标 CSS 片段 */
export function buildStopString(stop: ColorStop): string {
  const color = normalizeColor(stop.color);
  if (stop.position === 0 || stop.position === 100) {
    return color;
  }
  return `${color} ${stop.position.toFixed(1)}%`;
}

/** 生成完整 CSS 渐变字符串 */
export function buildGradientCss(options: GradientOptions): string {
  const sorted = sortStops(options.stops);
  const stopsString = sorted.map(buildStopString).join(', ');

  switch (options.type) {
    case 'linear':
      return `linear-gradient(${normalizeAngle(options.angle)}deg, ${stopsString})`;
    case 'radial': {
      const shape = options.shape;
      const center = `${options.centerX.toFixed(1)}% ${options.centerY.toFixed(1)}%`;
      return `radial-gradient(${shape} at ${center}, ${stopsString})`;
    }
    case 'conic': {
      const center = `${options.centerX.toFixed(1)}% ${options.centerY.toFixed(1)}%`;
      return `conic-gradient(from ${normalizeAngle(options.angle)}deg at ${center}, ${stopsString})`;
    }
    default:
      return `linear-gradient(90deg, ${stopsString})`;
  }
}

/** 生成用于预览的 background 样式 */
export function buildPreviewStyle(options: GradientOptions): string {
  return buildGradientCss(options);
}

/** 生成默认色标 */
export function createDefaultStops(): ColorStop[] {
  return [
    { id: generateId(), color: '#ff7e5f', position: 0 },
    { id: generateId(), color: '#feb47b', position: 100 },
  ];
}

/** 在指定位置插入新色标，颜色取相邻色标中点或默认灰 */
export function insertStop(stops: ColorStop[], position: number): ColorStop[] {
  const clamped = clampPosition(position);
  const sorted = sortStops(stops);
  const newStop: ColorStop = {
    id: generateId(),
    color: '#808080',
    position: clamped,
  };

  // 找到插入位置
  let insertIndex = sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].position > clamped) {
      insertIndex = i;
      break;
    }
  }

  return [
    ...sorted.slice(0, insertIndex),
    newStop,
    ...sorted.slice(insertIndex),
  ];
}

/** 删除指定 ID 的色标，保留至少 2 个 */
export function removeStop(stops: ColorStop[], id: string): ColorStop[] {
  if (stops.length <= 2) return stops;
  return stops.filter((s) => s.id !== id);
}

/** 预设渐变 */
export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    name: '日落',
    stops: [
      { id: 'preset-sunset-1', color: '#ff7e5f', position: 0 },
      { id: 'preset-sunset-2', color: '#feb47b', position: 100 },
    ],
  },
  {
    name: '海洋',
    stops: [
      { id: 'preset-ocean-1', color: '#2193b0', position: 0 },
      { id: 'preset-ocean-2', color: '#6dd5ed', position: 100 },
    ],
  },
  {
    name: '霓虹',
    stops: [
      { id: 'preset-neon-1', color: '#f857a6', position: 0 },
      { id: 'preset-neon-2', color: '#ff5858', position: 100 },
    ],
  },
];

/** 将 HEX 颜色解析为 RGB（用于 Canvas 取色等扩展） */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) {
    digits = digits.split('').map((ch) => ch + ch).join('');
  }
  const num = parseInt(digits, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}
```

- [ ] **Step 2: Commit the utility**

```bash
git add src/utils/css/gradient.ts
git commit -m "feat(css): 添加 CSS 渐变生成核心函数

支持 linear/radial/conic 三种渐变类型、色标排序与 CSS 输出"
```

---

## Task 2: Write unit tests

**Files:**
- Create: `src/utils/css/__tests__/gradient.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
/**
 * CSS 渐变生成单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  clampPosition,
  normalizeAngle,
  isValidColor,
  normalizeColor,
  sortStops,
  buildStopString,
  buildGradientCss,
  insertStop,
  removeStop,
  type GradientOptions,
  type ColorStop,
} from '../gradient';

describe('clampPosition', () => {
  it('钳制到 0–100', () => {
    expect(clampPosition(-5)).toBe(0);
    expect(clampPosition(50)).toBe(50);
    expect(clampPosition(150)).toBe(100);
  });
});

describe('normalizeAngle', () => {
  it('归一化到 0–360', () => {
    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
  });
});

describe('isValidColor', () => {
  it('有效颜色', () => {
    expect(isValidColor('#ff0000')).toBe(true);
    expect(isValidColor('#f00')).toBe(true);
    expect(isValidColor('rgb(255, 0, 0)')).toBe(true);
    expect(isValidColor('hsl(0, 100%, 50%)')).toBe(true);
  });

  it('无效颜色', () => {
    expect(isValidColor('')).toBe(false);
    expect(isValidColor('red')).toBe(false);
    expect(isValidColor('#12345')).toBe(false);
  });
});

describe('sortStops', () => {
  it('按 position 升序', () => {
    const stops: ColorStop[] = [
      { id: '2', color: '#00f', position: 100 },
      { id: '1', color: '#f00', position: 0 },
    ];
    const sorted = sortStops(stops);
    expect(sorted[0].id).toBe('1');
    expect(sorted[1].id).toBe('2');
  });
});

describe('buildGradientCss', () => {
  it('线性渐变', () => {
    const options: GradientOptions = {
      type: 'linear',
      angle: 90,
      centerX: 50,
      centerY: 50,
      shape: 'ellipse',
      stops: [
        { id: '1', color: '#ff0000', position: 0 },
        { id: '2', color: '#0000ff', position: 100 },
      ],
    };
    expect(buildGradientCss(options)).toBe('linear-gradient(90deg, #ff0000, #0000ff)');
  });

  it('径向渐变', () => {
    const options: GradientOptions = {
      type: 'radial',
      angle: 0,
      centerX: 50,
      centerY: 50,
      shape: 'circle',
      stops: [
        { id: '1', color: '#ff0000', position: 0 },
        { id: '2', color: '#0000ff', position: 100 },
      ],
    };
    expect(buildGradientCss(options)).toBe('radial-gradient(circle at 50.0% 50.0%, #ff0000, #0000ff)');
  });

  it('圆锥渐变', () => {
    const options: GradientOptions = {
      type: 'conic',
      angle: 0,
      centerX: 50,
      centerY: 50,
      shape: 'ellipse',
      stops: [
        { id: '1', color: '#ff0000', position: 0 },
        { id: '2', color: '#0000ff', position: 100 },
      ],
    };
    expect(buildGradientCss(options)).toBe('conic-gradient(from 0deg at 50.0% 50.0%, #ff0000, #0000ff)');
  });
});

describe('insertStop', () => {
  it('在指定位置插入新色标', () => {
    const stops: ColorStop[] = [
      { id: '1', color: '#f00', position: 0 },
      { id: '2', color: '#00f', position: 100 },
    ];
    const result = insertStop(stops, 50);
    expect(result).toHaveLength(3);
    expect(result[1].position).toBe(50);
  });
});

describe('removeStop', () => {
  it('删除指定色标', () => {
    const stops: ColorStop[] = [
      { id: '1', color: '#f00', position: 0 },
      { id: '2', color: '#00f', position: 100 },
      { id: '3', color: '#0f0', position: 50 },
    ];
    const result = removeStop(stops, '3');
    expect(result).toHaveLength(2);
  });

  it('至少保留 2 个色标', () => {
    const stops: ColorStop[] = [
      { id: '1', color: '#f00', position: 0 },
      { id: '2', color: '#00f', position: 100 },
    ];
    const result = removeStop(stops, '1');
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test src/utils/css/__tests__/gradient.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit tests**

```bash
git add src/utils/css/__tests__/gradient.test.ts
git commit -m "test(css): 添加 CSS 渐变生成单元测试"
```

---

## Task 3: Create the Vue component

**Files:**
- Create: `src/tools/css/CssGradientGenerator.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
/**
 * CSS 渐变生成器交互组件。
 *
 * 支持线性/径向/圆锥三种渐变，提供可视化色标拖动编辑、预设渐变与 CSS 复制。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import { useCopy } from '../../composables/useCopy';
import {
  GRADIENT_PRESETS,
  generateId,
  clampPosition,
  normalizeAngle,
  normalizeColor,
  isValidColor,
  buildGradientCss,
  buildPreviewStyle,
  createDefaultStops,
  insertStop,
  removeStop,
  type GradientType,
  type RadialShape,
  type ColorStop,
} from '../../utils/css/gradient';

// ---- 常量 ----

const GRADIENT_TYPES: { value: GradientType; label: string }[] = [
  { value: 'linear', label: '线性' },
  { value: 'radial', label: '径向' },
  { value: 'conic', label: '圆锥' },
];

// ---- 状态 ----

const type = ref<GradientType>('linear');
const angle = ref(90);
const centerX = ref(50);
const centerY = ref(50);
const shape = ref<RadialShape>('ellipse');
const stops = ref<ColorStop[]>(createDefaultStops());
const activeStopId = ref<string>(stops.value[0].id);
const colorError = ref('');
const trackRef = ref<HTMLDivElement | null>(null);

// 拖动状态
const isDragging = ref(false);
const draggedStopId = ref<string | null>(null);

const { copy } = useCopy();

// ---- 派生 ----

const gradientOptions = computed(() => ({
  type: type.value,
  angle: angle.value,
  centerX: centerX.value,
  centerY: centerY.value,
  shape: shape.value,
  stops: stops.value,
}));

const generatedCss = computed(() => buildGradientCss(gradientOptions.value));
const previewStyle = computed(() => ({
  background: buildPreviewStyle(gradientOptions.value),
}));

const activeStop = computed(() =>
  stops.value.find((s) => s.id === activeStopId.value) || stops.value[0]
);

// ---- 操作 ----

function handleTrackClick(event: MouseEvent): void {
  if (isDragging.value) return;
  const position = getPositionFromEvent(event);
  const newStops = insertStop(stops.value, position);
  stops.value = newStops;
  activeStopId.value = newStops.find((s) => s.position === position)?.id || activeStopId.value;
}

function handleStopMouseDown(stopId: string, event: MouseEvent): void {
  event.stopPropagation();
  isDragging.value = true;
  draggedStopId.value = stopId;
  activeStopId.value = stopId;
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event: MouseEvent): void {
  if (!isDragging.value || !draggedStopId.value) return;
  const position = getPositionFromEvent(event);
  const stop = stops.value.find((s) => s.id === draggedStopId.value);
  if (stop) {
    stop.position = position;
  }
}

function handleMouseUp(): void {
  isDragging.value = false;
  draggedStopId.value = null;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
}

function getPositionFromEvent(event: MouseEvent): number {
  if (!trackRef.value) return 0;
  const rect = trackRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  return clampPosition((x / rect.width) * 100);
}

function handleColorInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const color = target.value;
  if (!isValidColor(color)) {
    colorError.value = '颜色格式无效';
    return;
  }
  colorError.value = '';
  const stop = activeStop.value;
  if (stop) {
    stop.color = color;
  }
}

function handlePositionInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  const stop = activeStop.value;
  if (stop && Number.isFinite(value)) {
    stop.position = clampPosition(value);
  }
}

function handleDeleteStop(stopId: string): void {
  stops.value = removeStop(stops.value, stopId);
  if (!stops.value.find((s) => s.id === activeStopId.value)) {
    activeStopId.value = stops.value[0].id;
  }
}

function handlePreset(presetIndex: number): void {
  const preset = GRADIENT_PRESETS[presetIndex];
  if (!preset) return;
  stops.value = preset.stops.map((s) => ({ ...s, id: generateId() }));
  type.value = 'linear';
  activeStopId.value = stops.value[0].id;
}

function handleClear(): void {
  type.value = 'linear';
  angle.value = 90;
  centerX.value = 50;
  centerY.value = 50;
  shape.value = 'ellipse';
  stops.value = createDefaultStops();
  activeStopId.value = stops.value[0].id;
  colorError.value = '';
}

async function handleCopyCss(): Promise<void> {
  await copy(generatedCss.value);
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});
</script>

<template>
  <div>
    <ToolHeader
      title="CSS 渐变生成器"
      description="可视化创建线性、径向、圆锥渐变，拖动色标调整位置，一键复制 CSS 代码。"
      :show-example="false"
    />

    <!-- 类型与参数 -->
    <section class="mb-6 p-4 border border-border rounded-sm bg-card">
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <div>
          <label class="block text-xs text-muted mb-1.5">渐变类型</label>
          <select
            v-model="type"
            class="px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
          >
            <option v-for="t in GRADIENT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>

        <div v-if="type === 'linear' || type === 'conic'">
          <label class="block text-xs text-muted mb-1.5">角度（{{ normalizeAngle(angle) }}°）</label>
          <input
            v-model.number="angle"
            type="range"
            min="0"
            max="360"
            class="w-40"
          />
        </div>

        <div v-if="type === 'radial'">
          <label class="block text-xs text-muted mb-1.5">形状</label>
          <select
            v-model="shape"
            class="px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
          >
            <option value="ellipse">ellipse</option>
            <option value="circle">circle</option>
          </select>
        </div>

        <div v-if="type === 'radial' || type === 'conic'">
          <label class="block text-xs text-muted mb-1.5">中心 X（%）</label>
          <input
            v-model.number="centerX"
            type="number"
            min="0"
            max="100"
            class="w-20 px-2 py-2 border border-border rounded-sm bg-background text-text text-sm"
          />
        </div>

        <div v-if="type === 'radial' || type === 'conic'">
          <label class="block text-xs text-muted mb-1.5">中心 Y（%）</label>
          <input
            v-model.number="centerY"
            type="number"
            min="0"
            max="100"
            class="w-20 px-2 py-2 border border-border rounded-sm bg-background text-text text-sm"
          />
        </div>
      </div>
    </section>

    <!-- 预览 -->
    <section class="mb-6">
      <div
        class="h-40 rounded-sm border border-border"
        :style="previewStyle"
      />
    </section>

    <!-- 色标轨道 -->
    <section class="mb-6">
      <div
        ref="trackRef"
        class="relative h-6 rounded-sm cursor-crosshair"
        :style="previewStyle"
        @click="handleTrackClick"
      >
        <div
          v-for="stop in stops"
          :key="stop.id"
          class="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow cursor-pointer hover:scale-110 transition-transform"
          :class="activeStopId === stop.id ? 'ring-2 ring-accent z-10' : 'z-0'"
          :style="{ left: `calc(${stop.position}% - 10px)`, backgroundColor: stop.color }"
          @mousedown="handleStopMouseDown(stop.id, $event)"
          @click.stop
        />
      </div>
      <p class="mt-2 text-xs text-muted">点击轨道新增色标，拖动调整位置，双击下方色标或点击删除移除。</p>
    </section>

    <!-- 当前色标编辑 -->
    <section v-if="activeStop" class="mb-6 p-4 border border-border rounded-sm bg-card">
      <h3 class="text-sm font-semibold text-text mb-4">当前色标</h3>
      <div class="flex flex-wrap items-center gap-4">
        <div>
          <label class="block text-xs text-muted mb-1.5">颜色</label>
          <div class="flex items-center gap-2">
            <input
              :value="activeStop.color"
              type="color"
              class="w-10 h-10 p-0 border-0 rounded-sm cursor-pointer"
              @input="handleColorInput"
            />
            <input
              :value="activeStop.color"
              type="text"
              class="w-28 px-3 py-2 border rounded-sm bg-background text-text text-sm"
              :class="colorError ? 'border-error' : 'border-border'"
              @input="handleColorInput"
            />
          </div>
          <p v-if="colorError" class="mt-1.5 text-xs text-error">{{ colorError }}</p>
        </div>

        <div>
          <label class="block text-xs text-muted mb-1.5">位置（%）</label>
          <input
            :value="activeStop.position"
            type="number"
            min="0"
            max="100"
            class="w-24 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm"
            @input="handlePositionInput"
          />
        </div>

        <button
          type="button"
          class="self-end px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
          :disabled="stops.length <= 2"
          @click="handleDeleteStop(activeStop.id)"
        >
          删除色标
        </button>
      </div>
    </section>

    <!-- 预设 -->
    <section class="mb-6">
      <h3 class="text-sm font-semibold text-text mb-3">预设渐变</h3>
      <div class="flex flex-wrap gap-3">
        <button
          v-for="(preset, index) in GRADIENT_PRESETS"
          :key="preset.name"
          type="button"
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
          @click="handlePreset(index)"
        >
          {{ preset.name }}
        </button>
      </div>
    </section>

    <!-- 生成的 CSS -->
    <section class="mb-6">
      <label class="block text-xs text-muted mb-1.5">生成的 CSS</label>
      <pre class="p-4 border border-border rounded-sm bg-card text-sm text-text font-mono overflow-x-auto">{{ generatedCss }}</pre>
    </section>

    <!-- 操作栏 -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
        @click="handleClear"
      >
        清空
      </button>
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
        :disabled="!generatedCss"
        @click="handleCopyCss"
      >
        复制 CSS
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit the component**

```bash
git add src/tools/css/CssGradientGenerator.vue
git commit -m "feat(css): 添加 CSS 渐变生成器 Vue 组件

支持线性/径向/圆锥渐变、可视化色标拖动、预设渐变"
```

---

## Task 4: Create the Astro page

**Files:**
- Create: `src/pages/css/gradient.astro`

- [ ] **Step 1: Create the page**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import CssGradientGenerator from '../../tools/css/CssGradientGenerator.vue';
---

<ToolLayout toolId="css/gradient">
  <CssGradientGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 2: Commit the page**

```bash
git add src/pages/css/gradient.astro
git commit -m "feat(css): 添加 CSS 渐变生成器页面路由"
```

---

## Task 5: Register tool and update related tools

**Files:**
- Modify: `src/data/tools.ts`

- [ ] **Step 1: Add gradient tool registration**

在 `src/data/tools.ts` 的 `tools` 数组中，紧接 `unit-converter` 添加：

```ts
{
  id: 'gradient',
  name: 'CSS 渐变生成器',
  description: '可视化创建线性/径向/圆锥渐变并复制 CSS 代码',
  seoDescription: '在线 CSS 渐变生成器，支持线性、径向、圆锥三种渐变可视化调色与色标拖动编辑，一键复制 CSS 代码，纯浏览器端运算。',
  category: 'CSS 工具',
  icon: '🌈',
  path: '/css/gradient',
  keywords: ['css渐变生成器', 'linear-gradient', 'radial-gradient', 'conic-gradient', '渐变代码', 'css渐变工具'],
  relatedToolIds: ['unit-converter'],
},
```

- [ ] **Step 2: Update unit-converter relatedToolIds**

找到 `unit-converter` 的 `relatedToolIds`，从 `['gradient']` 保持不变（已在第一个 plan 中设置）。如果之前未设置，改为：

```ts
relatedToolIds: ['gradient'],
```

- [ ] **Step 3: Commit registration**

```bash
git add src/data/tools.ts
git commit -m "feat(css): 注册 CSS 渐变生成器工具并关联单位转换器"
```

---

## Task 6: Add FAQs

**Files:**
- Modify: `src/data/tool-faqs.ts`

- [ ] **Step 1: Add FAQ entries**

在 `toolFaqs` 对象中新增：

```ts
gradient: [
  {
    question: '支持重复渐变吗？',
    answer: '当前版本不支持 <code>repeating-*</code> 重复渐变。可以通过添加多个色标、缩小色标间距来模拟类似效果。',
  },
  {
    question: '圆锥渐变的浏览器兼容性如何？',
    answer: '圆锥渐变（<code>conic-gradient</code>）支持所有现代浏览器，包括 Chrome/Edge/Firefox/Safari，但不支持 Internet Explorer。',
  },
],
```

- [ ] **Step 2: Commit FAQs**

```bash
git add src/data/tool-faqs.ts
git commit -m "docs(css): 添加 CSS 渐变生成器 FAQ"
```

---

## Task 7: Verify and run

- [ ] **Step 1: Run unit tests**

```bash
pnpm test src/utils/css/__tests__/gradient.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Type check**

```bash
pnpm astro check
```

Expected: no TypeScript errors.

- [ ] **Step 3: Start dev server and smoke test**

```bash
pnpm dev
```

Open `http://localhost:4321/css/gradient` and verify:
- Default shows a sunset linear gradient.
- Dragging color stops updates the preview and CSS in real time.
- Clicking on the track adds a new color stop.
- Deleting a stop works when more than 2 stops exist.
- Preset buttons switch gradients.
- Switching between linear/radial/conic updates the parameters and output.
- "清空" resets to default.
- "复制 CSS" copies the generated gradient string.

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Expected: build succeeds with no errors.

---

## Self-Review Checklist

- [x] Spec coverage: 三种渐变类型、色标拖动、预设、CSS 输出、FAQ、注册表均已覆盖。
- [x] Placeholder scan: 无 TBD/TODO/"后续实现" 等占位符。
- [x] Type consistency: `GradientType`、`ColorStop`、`GradientOptions` 在工具函数和组件中一致。
