<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import dayjs from 'dayjs';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseFlexibleTimeInput,
  computeDuration,
  formatDurationParts,
  isoToDisplay,
} from '../../utils/datetime/datetime';

// ─── 时间差 section ───
const inputA = ref('');
const inputB = ref('');
const errorA = ref('');
const errorB = ref('');

/** 时间点显示与输入格式（精确到分，不含秒）。 */
const TIME_FORMAT = 'YYYY/MM/DD HH:mm';

/** 将毫秒时间戳格式化为显示用日期字符串（精确到分）。 */
function millisToDisplay(ms: number): string {
  return dayjs(ms).format(TIME_FORMAT);
}

/** 解析后的毫秒时间戳，无法识别为 null。 */
const millisA = computed(() => parseFlexibleTimeInput(inputA.value));
const millisB = computed(() => parseFlexibleTimeInput(inputB.value));

watch(inputA, (v) => {
  errorA.value = v.trim() && millisA.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm'
    : '';
});
watch(inputB, (v) => {
  errorB.value = v.trim() && millisB.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm'
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

// ─── 日期时间选择器（每个输入就近挂一个 datetime-local 控件，使弹出位置贴合输入框）───
type PickerSlot = 'a' | 'b';

const pickerRefA = ref<HTMLInputElement | null>(null);
const pickerRefB = ref<HTMLInputElement | null>(null);

/** 显示格式（yyyy/MM/dd HH:mm）→ datetime-local 取值（无秒 ISO），无法解析返回空串。 */
function displayToPickerIso(display: string): string {
  const d = dayjs(display.trim(), TIME_FORMAT, true);
  return d.isValid() ? d.format('YYYY-MM-DDTHH:mm') : '';
}

/** 各输入对应的选择器控件取值，用于定位选择器初始时刻。 */
const pickerValueA = computed(() => displayToPickerIso(inputA.value));
const pickerValueB = computed(() => displayToPickerIso(inputB.value));

/** 打开指定输入的原生日期时间选择器。 */
function openPicker(slot: PickerSlot) {
  const el = slot === 'a' ? pickerRefA.value : pickerRefB.value;
  if (!el) return;
  if (typeof el.showPicker === 'function') el.showPicker();
  else el.click();
}

/** 选择器确认后，把 ISO 取值转回显示格式填入对应输入。 */
function onPickerInput(slot: PickerSlot, event: Event) {
  const iso = (event.target as HTMLInputElement).value;
  if (!iso) return;
  const display = isoToDisplay(iso);
  if (slot === 'a') inputA.value = display;
  else inputB.value = display;
}

onMounted(() => {
  // 默认值：时间差 A=今天 00:00 / B=现在
  inputA.value = millisToDisplay(dayjs().startOf('day').valueOf());
  inputB.value = millisToDisplay(Date.now());
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="时间差计算器"
      description="计算两个时间点的时间差（天/时/分/秒 + 总秒数）"
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

      <!-- 输入卡片区：只含头部 + 输入 + 操作行，高度固定，左右齐平 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <!-- 时间点 A -->
        <div class="bg-surface border border-border rounded-sm overflow-hidden">
          <div class="px-3 py-2 border-b border-border bg-card">
            <label class="text-[0.8125rem] text-muted font-medium">时间点 A</label>
          </div>
          <div class="px-3 py-3">
            <input
              v-model="inputA"
              class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              placeholder="时间戳或 yyyy/MM/dd HH:mm"
              :aria-describedby="errorA ? 'diff-error-a' : undefined"
            />
          </div>
          <div class="px-3 py-2 border-t border-border bg-card flex items-center justify-end gap-3">
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              aria-label="打开日期时间选择器"
              @click="openPicker('a')"
            >
              📅 选择
            </button>
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              @click="fillNow('a')"
            >
              现在
            </button>
          </div>
          <input
            ref="pickerRefA"
            type="datetime-local"
            step="60"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            :value="pickerValueA"
            @input="onPickerInput('a', $event)"
          />
        </div>

        <!-- 时间点 B -->
        <div class="bg-surface border border-border rounded-sm overflow-hidden">
          <div class="px-3 py-2 border-b border-border bg-card">
            <label class="text-[0.8125rem] text-muted font-medium">时间点 B</label>
          </div>
          <div class="px-3 py-3">
            <input
              v-model="inputB"
              class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              placeholder="时间戳或 yyyy/MM/dd HH:mm"
              :aria-describedby="errorB ? 'diff-error-b' : undefined"
            />
          </div>
          <div class="px-3 py-2 border-t border-border bg-card flex items-center justify-end gap-3">
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              aria-label="打开日期时间选择器"
              @click="openPicker('b')"
            >
              📅 选择
            </button>
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              @click="fillNow('b')"
            >
              现在
            </button>
          </div>
          <input
            ref="pickerRefB"
            type="datetime-local"
            step="60"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            :value="pickerValueB"
            @input="onPickerInput('b', $event)"
          />
        </div>
      </div>

      <!-- 错误占位区：独立于卡片，换行只撑自己那一列，不影响输入卡片对齐 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <div class="min-h-[20px]">
          <p v-if="errorA" id="diff-error-a" class="text-error text-[0.8125rem] m-0">{{ errorA }}</p>
        </div>
        <div class="min-h-[20px]">
          <p v-if="errorB" id="diff-error-b" class="text-error text-[0.8125rem] m-0">{{ errorB }}</p>
        </div>
      </div>

      <!-- 时间差结果 -->
      <div v-if="diffDisplay" class="flex items-center gap-3 px-4 py-3 mt-3 border border-border rounded-sm bg-surface">
        <span class="text-xs font-semibold text-accent min-w-16 shrink-0">时间差</span>
        <code class="flex-1 font-mono text-sm text-text select-all break-all">{{ diffDisplay }}</code>
        <CopyButton :text="diffDisplay" size="sm" />
      </div>
      <div v-if="diffResult" class="flex items-center gap-3 px-4 py-2 mt-2 border border-border rounded-sm bg-surface">
        <span class="text-xs font-semibold text-accent min-w-16 shrink-0">总秒数</span>
        <code class="flex-1 font-mono text-sm text-text select-all">{{ diffResult.totalSeconds }}</code>
        <CopyButton :text="String(diffResult.totalSeconds)" size="sm" />
      </div>
    </section>

  </div>
</template>
