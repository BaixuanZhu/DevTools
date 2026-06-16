<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import dayjs from 'dayjs';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseFlexibleTimeInput,
  computeDuration,
  formatDurationParts,
} from '../../utils/datetime/datetime';

/** 日期显示格式，与日期时间转换器保持一致。 */
const DATE_DISPLAY_FORMAT = 'YYYY/MM/DD HH:mm:ss';

// ─── 时间差 section ───
const inputA = ref('');
const inputB = ref('');
const errorA = ref('');
const errorB = ref('');

/** 将毫秒时间戳格式化为显示用日期字符串。 */
function millisToDisplay(ms: number): string {
  return dayjs(ms).format(DATE_DISPLAY_FORMAT);
}

/** 解析后的毫秒时间戳，无法识别为 null。 */
const millisA = computed(() => parseFlexibleTimeInput(inputA.value));
const millisB = computed(() => parseFlexibleTimeInput(inputB.value));

watch(inputA, (v) => {
  errorA.value = v.trim() && millisA.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm:ss'
    : '';
});
watch(inputB, (v) => {
  errorB.value = v.trim() && millisB.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm:ss'
    : '';
});

/** 时间差拆解结果，任一输入无效时为 null。 */
const diffResult = computed(() => {
  if (millisA.value === null || millisB.value === null) return null;
  return computeDuration(millisA.value, millisB.value);
});

/** 时间差展示文案（含方向）。 */
const diffDisplay = computed(() => {
  if (!diffResult.value) return '';
  const d = diffResult.value;
  if (d.sign === 0) return 'A 与 B 相同';
  return d.sign > 0 ? `A 比 B 晚 ${formatDurationParts(d)}` : `A 比 B 早 ${formatDurationParts(d)}`;
});

/** 「现在」快捷：把当前时间填入指定输入框。 */
function fillNow(target: 'a' | 'b') {
  const display = millisToDisplay(Date.now());
  if (target === 'a') inputA.value = display;
  else inputB.value = display;
}

function clearDiff() {
  inputA.value = '';
  inputB.value = '';
  errorA.value = '';
  errorB.value = '';
}

// ─── 倒计时 section ───
const targetInput = ref('');
const targetError = ref('');
/** 每秒刷新的当前时间戳，驱动倒计时实时更新。 */
const nowTick = ref(Date.now());
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const targetMillis = computed(() => parseFlexibleTimeInput(targetInput.value));

watch(targetInput, (v) => {
  targetError.value = v.trim() && targetMillis.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm:ss'
    : '';
});

/** 倒计时拆解结果（target 相对 now），目标无效时为 null。 */
const countdown = computed(() => {
  if (targetMillis.value === null) return null;
  return computeDuration(targetMillis.value, nowTick.value);
});

/** 是否处于倒计时状态（目标在未来）。 */
const isCountingDown = computed(() => countdown.value !== null && countdown.value.sign > 0);

/** 倒计时展示文案：未来为大字倒数，过期转正计时。 */
const countdownDisplay = computed(() => {
  if (!countdown.value) return '';
  const c = countdown.value;
  if (c.sign > 0) {
    return `${c.days}天 ${pad2(c.hours)}:${pad2(c.minutes)}:${pad2(c.seconds)}`;
  }
  return `已过期，距今 ${formatDurationParts(c)}`;
});

/** 数字补零至两位。 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fillNowTarget() {
  targetInput.value = millisToDisplay(Date.now());
}

function clearCountdown() {
  targetInput.value = '';
  targetError.value = '';
}

/**
 * 监听倒计时跨越到点：sign 从正（未来）变为非正（已到点/过期）时触发一次 Toast。
 * 一开始就过期（从未进入未来）的不提示。
 */
watch(countdown, (cur, prev) => {
  if (!cur) return;
  if (cur.sign <= 0 && prev && prev.sign > 0) {
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '时间到了' } }));
  }
});

onMounted(() => {
  // 默认值：时间差 A=今天 00:00 / B=现在；倒计时目标=明天此刻
  inputA.value = millisToDisplay(dayjs().startOf('day').valueOf());
  inputB.value = millisToDisplay(Date.now());
  targetInput.value = millisToDisplay(dayjs().add(1, 'day').valueOf());

  countdownTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="时间差与倒计时"
      description="计算两个时间点的时间差，以及对未来时刻实时倒计时"
      :show-example="false"
    />

    <!-- ═══ 时间差计算 ═══ -->
    <section class="mb-6 p-4 border border-border rounded-md bg-card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">📏</span> 时间差计算
        </h2>
        <ClearButton @clear="clearDiff" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <!-- 时间点 A -->
        <div class="bg-surface border border-border rounded-sm overflow-hidden">
          <div class="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
            <label class="text-[0.8125rem] text-muted font-medium">时间点 A</label>
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              @click="fillNow('a')"
            >
              现在
            </button>
          </div>
          <div class="px-3 py-3">
            <input
              v-model="inputA"
              class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              placeholder="时间戳或 yyyy/MM/dd HH:mm:ss"
            />
          </div>
          <div class="px-3 py-2 border-t border-border bg-card min-h-[28px]">
            <p v-if="errorA" class="text-error text-[0.8125rem] m-0">{{ errorA }}</p>
          </div>
        </div>

        <!-- 时间点 B -->
        <div class="bg-surface border border-border rounded-sm overflow-hidden">
          <div class="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
            <label class="text-[0.8125rem] text-muted font-medium">时间点 B</label>
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              @click="fillNow('b')"
            >
              现在
            </button>
          </div>
          <div class="px-3 py-3">
            <input
              v-model="inputB"
              class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              placeholder="时间戳或 yyyy/MM/dd HH:mm:ss"
            />
          </div>
          <div class="px-3 py-2 border-t border-border bg-card min-h-[28px]">
            <p v-if="errorB" class="text-error text-[0.8125rem] m-0">{{ errorB }}</p>
          </div>
        </div>
      </div>

      <!-- 时间差结果 -->
      <div v-if="diffDisplay" class="flex items-center gap-3 px-4 py-3 border border-border rounded-sm bg-surface">
        <span class="text-xs font-semibold text-accent min-w-[64px] shrink-0">时间差</span>
        <code class="flex-1 font-mono text-sm text-text select-all break-all">{{ diffDisplay }}</code>
        <CopyButton :text="diffDisplay" size="sm" />
      </div>
      <div v-if="diffResult" class="flex items-center gap-3 px-4 py-2 mt-2 border border-border rounded-sm bg-surface">
        <span class="text-xs font-semibold text-accent min-w-[64px] shrink-0">总秒数</span>
        <code class="flex-1 font-mono text-sm text-text select-all">{{ diffResult.totalSeconds }}</code>
        <CopyButton :text="String(diffResult.totalSeconds)" size="sm" />
      </div>
    </section>

    <!-- ═══ 倒计时 ═══ -->
    <section class="p-4 border border-border rounded-md bg-card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">⏳</span> 倒计时
        </h2>
        <ClearButton @clear="clearCountdown" />
      </div>

      <div class="bg-surface border border-border rounded-sm overflow-hidden mb-4">
        <div class="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
          <label class="text-[0.8125rem] text-muted font-medium">目标时间</label>
          <button
            type="button"
            class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
            @click="fillNowTarget"
          >
            现在
          </button>
        </div>
        <div class="px-3 py-3">
          <input
            v-model="targetInput"
            class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
            placeholder="时间戳或 yyyy/MM/dd HH:mm:ss"
          />
        </div>
        <div class="px-3 py-2 border-t border-border bg-card min-h-[28px]">
          <p v-if="targetError" class="text-error text-[0.8125rem] m-0">{{ targetError }}</p>
        </div>
      </div>

      <!-- 大字倒计时 / 正计时 -->
      <div
        v-if="countdownDisplay"
        class="flex flex-col items-center justify-center py-6 border border-border rounded-sm bg-surface"
      >
        <div
          class="font-mono font-bold tracking-wider tabular-nums text-center break-all"
          :class="isCountingDown ? 'text-4xl text-accent' : 'text-xl text-muted'"
        >
          {{ countdownDisplay }}
        </div>
        <p class="text-xs text-muted mt-2 m-0">
          {{ isCountingDown ? '距目标还有' : '目标已过期' }}
        </p>
      </div>
      <div v-else class="flex items-center justify-center py-6 border border-border rounded-sm bg-surface">
        <p class="text-muted text-[0.8125rem] m-0">输入目标时间开始倒计时</p>
      </div>
    </section>
  </div>
</template>
