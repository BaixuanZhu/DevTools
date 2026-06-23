<script setup lang="ts">
/**
 * 颜色面板工具组件。
 *
 * 单列竖向布局，以「当前色」为单一数据源：顶部色板 + HEX 输入 + 原生选色器；
 * 中部 HEX/RGB/HSL/HSV 四行可编辑分量、实时联动；下方 WCAG 对比度检查与配色板。
 */
import { ref, reactive, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  type RGB,
} from '../../utils/color/color-space';
import { contrastRatio, evaluateWcag } from '../../utils/color/wcag';
import {
  generateHarmony,
  HARMONY_LABELS,
  type HarmonyScheme,
} from '../../utils/color/color-harmony';

/** 默认当前色（Tailwind blue-500） */
const DEFAULT_RGB: RGB = { r: 59, g: 130, b: 246 };

/** 当前色：单一数据源，所有输入框提交后都更新它，再由 watch 同步回各输入框 */
const currentColor = ref<RGB>({ ...DEFAULT_RGB });

/** HEX 输入字符串（本地态，提交时解析） */
const hexInput = ref(rgbToHex(currentColor.value));
const hexError = ref('');

/** RGB 分量输入 */
const rgbInput = reactive({ r: 59, g: 130, b: 246 });
/** HSL 分量输入 */
const hslInput = reactive({ h: 0, s: 0, l: 0 });
/** HSV 分量输入 */
const hsvInput = reactive({ h: 0, s: 0, v: 0 });

/** 对比度背景色 HEX */
const bgHexInput = ref('#FFFFFF');
const bgError = ref('');

/** 配色板当前方案 */
const scheme = ref<HarmonyScheme>('complementary');

/** 配色方案列表（key → 中文标签） */
const schemes = Object.entries(HARMONY_LABELS) as [HarmonyScheme, string][];

/** WCAG 等级展示配置 */
const WCAG_LEVELS = [
  { key: 'aaNormal', label: 'AA 普通' },
  { key: 'aaLarge', label: 'AA 大字' },
  { key: 'aaaNormal', label: 'AAA 普通' },
  { key: 'aaaLarge', label: 'AAA 大字' },
] as const;

// ---- 钳制工具 ----

/** 钳制到 0–255 整数 */
function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n) || 0));
}

/** 钳制到 0–100 整数 */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n) || 0));
}

/** 角度归一化到 0–360 */
function clampAngle(n: number): number {
  return ((((Math.round(n) || 0) % 360) + 360) % 360);
}

// ---- 派生展示值 ----

/** 当前色 HEX（规范化，用于展示与复制） */
const currentHex = computed(() => rgbToHex(currentColor.value));

/** 当前色 CSS（色板背景） */
const currentCss = computed(
  () => `rgb(${currentColor.value.r}, ${currentColor.value.g}, ${currentColor.value.b})`,
);

/** RGB / HSL / HSV 的 CSS 字符串（用于复制） */
const rgbString = computed(
  () => `rgb(${currentColor.value.r}, ${currentColor.value.g}, ${currentColor.value.b})`,
);
const hslString = computed(() => {
  const h = rgbToHsl(currentColor.value);
  return `hsl(${h.h}, ${h.s}%, ${h.l}%)`;
});
const hsvString = computed(() => {
  const h = rgbToHsv(currentColor.value);
  return `hsv(${h.h}, ${h.s}%, ${h.v}%)`;
});

/** 背景色 RGB（解析失败为 null） */
const bgRgb = computed(() => hexToRgb(bgHexInput.value));

/** 背景色 CSS */
const bgCss = computed(() =>
  bgRgb.value ? `rgb(${bgRgb.value.r}, ${bgRgb.value.g}, ${bgRgb.value.b})` : 'transparent',
);

/** 背景色规范化 HEX（供原生选色器 value） */
const bgColorValue = computed(() => (bgRgb.value ? rgbToHex(bgRgb.value) : '#ffffff'));

/** 对比度比值（背景非法时为 null） */
const ratio = computed(() =>
  bgRgb.value ? contrastRatio(currentColor.value, bgRgb.value) : null,
);

/** WCAG 达标判定 */
const wcag = computed(() => (ratio.value === null ? null : evaluateWcag(ratio.value)));

/** 配色板色块 */
const harmonyColors = computed(() => generateHarmony(currentColor.value, scheme.value));

// ---- 同步：currentColor 变化 → 刷新所有输入框 ----

watch(
  currentColor,
  (c) => {
    hexInput.value = rgbToHex(c);
    hexError.value = '';
    rgbInput.r = c.r;
    rgbInput.g = c.g;
    rgbInput.b = c.b;
    const hsl = rgbToHsl(c);
    hslInput.h = hsl.h;
    hslInput.s = hsl.s;
    hslInput.l = hsl.l;
    const hsv = rgbToHsv(c);
    hsvInput.h = hsv.h;
    hsvInput.s = hsv.s;
    hsvInput.v = hsv.v;
  },
  { immediate: true },
);

// ---- 提交：各输入框 → currentColor ----

/** 提交 HEX 输入 */
function commitHex(): void {
  const rgb = hexToRgb(hexInput.value);
  if (!rgb) {
    hexError.value = '请输入合法的 HEX 颜色，如 #3B82F6 或 #3B8';
    return;
  }
  currentColor.value = rgb;
}

/** 提交 RGB 分量 */
function commitRgb(): void {
  currentColor.value = {
    r: clamp255(rgbInput.r),
    g: clamp255(rgbInput.g),
    b: clamp255(rgbInput.b),
  };
}

/** 提交 HSL 分量 */
function commitHsl(): void {
  currentColor.value = hslToRgb({
    h: clampAngle(hslInput.h),
    s: clamp100(hslInput.s),
    l: clamp100(hslInput.l),
  });
}

/** 提交 HSV 分量 */
function commitHsv(): void {
  currentColor.value = hsvToRgb({
    h: clampAngle(hsvInput.h),
    s: clamp100(hsvInput.s),
    v: clamp100(hsvInput.v),
  });
}

/** 原生选色器变更（前景） */
function onPick(event: Event): void {
  const rgb = hexToRgb((event.target as HTMLInputElement).value);
  if (rgb) currentColor.value = rgb;
}

/** 原生选色器变更（背景） */
function onPickBg(event: Event): void {
  bgHexInput.value = (event.target as HTMLInputElement).value;
  bgError.value = '';
}

/** 提交背景色输入 */
function commitBg(): void {
  bgError.value = hexToRgb(bgHexInput.value) ? '' : '请输入合法的 HEX 背景色';
}

/** 配色板色块点击 → 设为当前色 */
function selectHarmony(rgb: RGB): void {
  currentColor.value = { ...rgb };
}

/** 重置为默认色 */
function reset(): void {
  currentColor.value = { ...DEFAULT_RGB };
}
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="颜色面板"
      description="HEX/RGB/HSL/HSV 实时互转、WCAG 对比度检查、互补/类似/三角配色板"
      :show-example="false"
    />

    <!-- ① 顶部色板区 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden mb-4">
      <div
        class="h-24"
        :style="{ backgroundColor: currentCss }"
        role="img"
        aria-label="当前颜色预览"
      ></div>
      <div class="flex items-center gap-2 p-3 flex-wrap">
        <label class="text-sm text-muted shrink-0" for="hex-input">HEX</label>
        <input
          id="hex-input"
          v-model="hexInput"
          type="text"
          class="flex-1 min-w-35 px-2 py-1.5 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus:border-accent"
          placeholder="#3B82F6"
          spellcheck="false"
          aria-label="HEX 颜色输入"
          @change="commitHex"
          @keyup.enter="commitHex"
        />
        <input
          type="color"
          :value="currentHex"
          class="w-9 h-9 p-0 border border-border rounded-sm cursor-pointer bg-card"
          aria-label="打开选色器"
          @input="onPick"
        />
        <CopyButton :text="currentHex" />
        <button
          type="button"
          class="px-3 py-1.5 rounded-sm border border-border bg-card text-text text-sm hover:bg-hover transition-[background-color] duration-150 cursor-pointer focus:outline-none"
          @click="reset"
        >
          重置
        </button>
      </div>
      <div v-if="hexError" class="px-3 pb-2 text-[0.75rem] text-error" role="alert">
        {{ hexError }}
      </div>
    </div>

    <!-- ② 空间表示区 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden mb-4">
      <!-- HEX 只读行 -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span class="w-12 text-sm text-muted shrink-0">HEX</span>
        <span class="flex-1 font-mono text-sm text-text">{{ currentHex }}</span>
        <CopyButton :text="currentHex" size="sm" />
      </div>
      <!-- RGB -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span class="w-12 text-sm text-muted shrink-0">RGB</span>
        <div class="flex-1 flex items-center gap-1">
          <input
            v-model.number="rgbInput.r"
            type="number"
            min="0"
            max="255"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="R 通道"
            @change="commitRgb"
          />
          <input
            v-model.number="rgbInput.g"
            type="number"
            min="0"
            max="255"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="G 通道"
            @change="commitRgb"
          />
          <input
            v-model.number="rgbInput.b"
            type="number"
            min="0"
            max="255"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="B 通道"
            @change="commitRgb"
          />
        </div>
        <CopyButton :text="rgbString" size="sm" />
      </div>
      <!-- HSL -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span class="w-12 text-sm text-muted shrink-0">HSL</span>
        <div class="flex-1 flex items-center gap-1">
          <input
            v-model.number="hslInput.h"
            type="number"
            min="0"
            max="360"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="H 色相"
            @change="commitHsl"
          />
          <input
            v-model.number="hslInput.s"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="S 饱和度"
            @change="commitHsl"
          />
          <input
            v-model.number="hslInput.l"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="L 亮度"
            @change="commitHsl"
          />
        </div>
        <CopyButton :text="hslString" size="sm" />
      </div>
      <!-- HSV -->
      <div class="flex items-center gap-2 px-3 py-2">
        <span class="w-12 text-sm text-muted shrink-0">HSV</span>
        <div class="flex-1 flex items-center gap-1">
          <input
            v-model.number="hsvInput.h"
            type="number"
            min="0"
            max="360"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="H 色相"
            @change="commitHsv"
          />
          <input
            v-model.number="hsvInput.s"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="S 饱和度"
            @change="commitHsv"
          />
          <input
            v-model.number="hsvInput.v"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="V 明度"
            @change="commitHsv"
          />
        </div>
        <CopyButton :text="hsvString" size="sm" />
      </div>
    </div>

    <!-- ③ WCAG 对比度检查 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden mb-4">
      <div class="px-3 py-1.5 border-b border-border text-[0.8125rem] text-muted">
        WCAG 对比度检查
      </div>
      <div class="p-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">前景</span>
          <span
            class="w-7 h-7 rounded-sm border border-border"
            :style="{ backgroundColor: currentCss }"
          ></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">背景</span>
          <span
            class="w-7 h-7 rounded-sm border border-border"
            :style="{ backgroundColor: bgCss }"
          ></span>
          <input
            v-model="bgHexInput"
            type="text"
            class="w-24 px-2 py-1 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus:border-accent"
            aria-label="背景色 HEX"
            @change="commitBg"
          />
          <input
            type="color"
            :value="bgColorValue"
            class="w-8 h-8 p-0 border border-border rounded-sm cursor-pointer bg-card"
            aria-label="背景选色器"
            @input="onPickBg"
          />
        </div>
      </div>
      <div v-if="bgError" class="px-3 pb-2 text-[0.75rem] text-error" role="alert">
        {{ bgError }}
      </div>
      <div v-else-if="ratio !== null && wcag" class="px-3 pb-3">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-2xl font-semibold text-text">{{ ratio.toFixed(2) }}</span>
          <span class="text-sm text-muted">: 1</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div
            v-for="lvl in WCAG_LEVELS"
            :key="lvl.key"
            :class="[
              'px-2 py-1.5 rounded-sm text-center text-[0.75rem] border',
              wcag[lvl.key]
                ? 'border-success text-success'
                : 'border-border text-muted',
            ]"
          >
            {{ wcag[lvl.key] ? '✅' : '❌' }} {{ lvl.label }}
          </div>
        </div>
        <!-- 示例文字预览（前景=当前色，背景=背景色） -->
        <div class="rounded-sm p-3" :style="{ backgroundColor: bgCss }">
          <p class="text-base m-0 mb-1" :style="{ color: currentCss }">
            The quick brown fox 你好世界 123
          </p>
          <p class="text-lg font-bold m-0" :style="{ color: currentCss }">AaBb 大字示例</p>
        </div>
      </div>
    </div>

    <!-- ④ 配色板 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden">
      <div class="px-3 py-1.5 border-b border-border text-[0.8125rem] text-muted">配色板</div>
      <div class="p-3">
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            v-for="[key, label] in schemes"
            :key="key"
            type="button"
            :class="[
              'px-3 py-1.5 rounded-sm border text-sm cursor-pointer transition-[background-color,border-color] duration-150 focus:outline-none',
              scheme === key
                ? 'bg-accent text-white border-accent'
                : 'bg-card text-muted border-border hover:bg-hover hover:text-text',
            ]"
            @click="scheme = key"
          >
            {{ label }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(c, i) in harmonyColors"
            :key="i"
            type="button"
            class="relative h-14 flex-1 min-w-20 rounded-sm border border-border overflow-hidden cursor-pointer focus:outline-none"
            :style="{ backgroundColor: `rgb(${c.r}, ${c.g}, ${c.b})` }"
            :title="rgbToHex(c)"
            :aria-label="`选择颜色 ${rgbToHex(c)}`"
            @click="selectHarmony(c)"
          >
            <span
              class="absolute bottom-1 left-1 right-1 text-[0.625rem] font-mono text-white bg-black/40 px-1 py-0.5 rounded-sm"
              >{{ rgbToHex(c) }}</span
            >
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
