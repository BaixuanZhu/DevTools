<script setup lang="ts">
/**
 * CSS 渐变生成器交互组件。
 *
 * 支持线性/径向/圆锥三种渐变，提供可视化色标拖动编辑、预设渐变与 CSS 复制。
 */
import { ref, computed, onUnmounted } from 'vue';
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
  background: generatedCss.value,
}));

const activeStop = computed(() =>
  stops.value.find((s) => s.id === activeStopId.value) || stops.value[0]
);

// ---- 操作 ----

function handleTrackClick(event: MouseEvent): void {
  const position = getPositionFromEvent(event);
  const newId = generateId();
  const newStop: ColorStop = {
    id: newId,
    color: '#808080',
    position: clampPosition(position),
  };

  const sorted = [...stops.value].sort((a, b) => a.position - b.position);
  let insertIndex = sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].position > newStop.position) {
      insertIndex = i;
      break;
    }
  }
  stops.value = [
    ...sorted.slice(0, insertIndex),
    newStop,
    ...sorted.slice(insertIndex),
  ];
  activeStopId.value = newId;
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
  stops.value = stops.value.map((s) =>
    s.id === draggedStopId.value ? { ...s, position } : s
  );
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
      <p class="mt-2 text-xs text-muted">点击轨道新增色标，拖动调整位置，点击下方删除按钮移除。</p>
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
