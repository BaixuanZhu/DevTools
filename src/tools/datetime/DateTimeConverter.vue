<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import dayjs from 'dayjs';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  getLiveClockInfo,
  getQuickTimestamp,
  TIMEZONES,
  QUICK_TIME_OPTIONS,
  type QuickTimeType,
} from '../../utils/datetime/datetime';

/** 统一结果面板的数据模型。 */
interface UnifiedResult {
  /** 数据来源：'timestamp' | 'date' | null */
  source: 'timestamp' | 'date' | null;
  /** ISO 8601 格式 */
  iso: string;
  /** 本地日期时间 */
  local: string;
  /** UTC 时间 */
  utc: string;
  /** 指定时区的时间 */
  tzTime: string;
  /** RFC 2822 格式 */
  rfc2822: string;
  /** 相对时间 */
  relative: string;
  /** Unix 秒级时间戳 */
  unixSeconds: number;
  /** Unix 毫秒级时间戳 */
  unixMillis: number;
  /** 自定义格式结果 */
  custom: string;
}

// ─── 实时时钟区 ───
const isMounted = ref(false);
const liveClock = ref<{
  unixSeconds: number;
  unixMillis: number;
  iso: string;
  local: string;
  utc: string;
  tzTime: string;
}>({
  unixSeconds: 0,
  unixMillis: 0,
  iso: '-',
  local: '-',
  utc: '-',
  tzTime: '-',
});
const liveTimezone = ref('local');
let liveTimer: ReturnType<typeof setInterval> | null = null;

function updateLiveClock() {
  liveClock.value = getLiveClockInfo(liveTimezone.value);
}

watch(liveTimezone, () => {
  if (isMounted.value) {
    updateLiveClock();
  }
});

onMounted(() => {
  isMounted.value = true;
  updateLiveClock();
  liveTimer = setInterval(updateLiveClock, 1000);
  // 默认用当前时间预填充两个输入框
  timestampInput.value = String(Date.now());
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const display = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  dateInput.value = display;
  pickerValue.value = displayToIso(display);
});

onUnmounted(() => {
  if (liveTimer) clearInterval(liveTimer);
});

// ─── 共享配置 ───
const convertTimezone = ref('local');
const customFormatStr = ref('YYYY-MM-DD HH:mm:ss');

// ─── 统一结果 ───
const unifiedResult = ref<UnifiedResult | null>(null);
const lastActiveInput = ref<'timestamp' | 'date' | null>(null);

watch([convertTimezone, customFormatStr], () => {
  if (!unifiedResult.value) return;
  const ts = unifiedResult.value.unixMillis;
  const info = timestampToDateInfo(ts, convertTimezone.value, customFormatStr.value);
  unifiedResult.value = { ...unifiedResult.value, ...info };
});

// ─── 时间戳输入 ───
const timestampInput = ref('');
const tsErrorMsg = ref('');

watch(timestampInput, () => {
  tsErrorMsg.value = '';
  const input = timestampInput.value.trim();
  if (!input) {
    if (lastActiveInput.value === 'timestamp') {
      unifiedResult.value = null;
      lastActiveInput.value = null;
    }
    return;
  }
  const unit = detectTimestampUnit(input);
  if (!unit) {
    tsErrorMsg.value = '无法识别时间戳格式，请输入 10 位（秒）或 13 位（毫秒）数字';
    if (lastActiveInput.value === 'timestamp') {
      unifiedResult.value = null;
    }
    return;
  }
  const ts = Number(input);
  const millis = unit === 's' ? ts * 1000 : ts;
  const info = timestampToDateInfo(millis, convertTimezone.value, customFormatStr.value);
  unifiedResult.value = { source: 'timestamp', ...info };
  lastActiveInput.value = 'timestamp';
});

function fillNow() {
  timestampInput.value = String(Date.now());
}

function handleQuickTime(type: QuickTimeType) {
  timestampInput.value = String(getQuickTimestamp(type));
}

// ─── 日期输入 ───
const DATE_DISPLAY_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const dateInput = ref('');
const dateErrorMsg = ref('');
const pickerValue = ref('');
const datePickerRef = ref<HTMLInputElement | null>(null);

function displayToIso(display: string): string {
  const d = dayjs(display.trim(), DATE_DISPLAY_FORMAT, true);
  return d.isValid() ? d.format('YYYY-MM-DDTHH:mm:ss') : '';
}

function isoToDisplay(iso: string): string {
  return iso.replace('T', ' ').replace(/-/g, '/');
}

function openDatePicker() {
  const input = datePickerRef.value;
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.click();
  }
}

function onPickerInput(event: Event) {
  const iso = (event.target as HTMLInputElement).value;
  if (iso) {
    dateInput.value = isoToDisplay(iso);
  }
}

watch(dateInput, () => {
  const input = dateInput.value.trim();
  dateErrorMsg.value = '';
  if (!input) {
    if (lastActiveInput.value === 'date') {
      unifiedResult.value = null;
      lastActiveInput.value = null;
    }
    pickerValue.value = '';
    return;
  }
  const result = parseDateInput(input, convertTimezone.value, customFormatStr.value);
  if (result) {
    unifiedResult.value = { source: 'date', ...result };
    lastActiveInput.value = 'date';
    pickerValue.value = displayToIso(input);
  } else {
    dateErrorMsg.value = '请输入标准格式 yyyy/MM/dd HH:mm:ss';
    pickerValue.value = '';
    if (lastActiveInput.value === 'date') {
      unifiedResult.value = null;
    }
  }
});

function clearAll() {
  timestampInput.value = '';
  dateInput.value = '';
  pickerValue.value = '';
  tsErrorMsg.value = '';
  dateErrorMsg.value = '';
  unifiedResult.value = null;
  lastActiveInput.value = null;
}

const liveClockFields = computed(() => [
  { label: 'Unix 秒', value: String(liveClock.value.unixSeconds) },
  { label: 'Unix 毫秒', value: String(liveClock.value.unixMillis) },
  { label: 'ISO 8601', value: liveClock.value.iso },
  { label: '本地时间', value: liveClock.value.local },
  { label: 'UTC 时间', value: liveClock.value.utc },
  ...(liveTimezone.value !== 'local'
    ? [{ label: TIMEZONES.find(t => t.value === liveTimezone.value)?.label ?? '时区时间', value: liveClock.value.tzTime }]
    : []),
]);

const unifiedResultFields = computed(() => {
  if (!unifiedResult.value) return [];
  const r = unifiedResult.value;
  const fields = [
    { label: 'ISO 8601', value: r.iso },
    { label: '本地时间', value: r.local },
    { label: 'UTC 时间', value: r.utc },
    { label: 'Unix 毫秒', value: String(r.unixMillis) },
    { label: 'Unix 秒', value: String(r.unixSeconds) },
  ];
  if (convertTimezone.value !== 'local') {
    const tzLabel = TIMEZONES.find(t => t.value === convertTimezone.value)?.label ?? '时区时间';
    fields.push({ label: tzLabel, value: r.tzTime });
  }
  fields.push(
    { label: 'RFC 2822', value: r.rfc2822 },
    { label: '相对时间', value: r.relative },
    { label: '自定义格式', value: r.custom },
  );
  return fields;
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader title="日期时间转换器" description="时间戳与日期格式互转，支持时区与自定义格式" :show-example="false" />

    <!-- ═══ 实时时钟区 ═══ -->
    <section class="mb-6 p-4 border border-border rounded-md bg-card">
      <div class="flex items-center gap-3 mb-3 flex-wrap">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">⏱</span> 当前时间
        </h2>
        <SelectListbox
          v-model="liveTimezone"
          :options="TIMEZONES"
          class="w-32"
        />
      </div>

      <div class="flex flex-col gap-1">
        <div
          v-for="field in liveClockFields"
          :key="field.label"
          class="flex items-center gap-3 px-3 py-1 rounded-sm transition-colors duration-100 hover:bg-hover"
        >
          <span class="text-xs font-semibold text-accent min-w-[72px] shrink-0">{{ field.label }}</span>
          <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ isMounted ? field.value : '-' }}</code>
          <CopyButton
            v-if="isMounted"
            :text="field.value"
            label="复制"
            class="px-2 py-1 text-xs shrink-0"
          />
          <span v-else class="shrink-0 text-xs text-muted w-[24px] text-center">📋</span>
        </div>
      </div>
    </section>

    <!-- ═══ 双栏工作区：输入左 / 输出右 ═══ -->
    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <section class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold m-0 text-text">日期，时间戳</h2>
            <ClearButton @clear="clearAll" />
          </div>

          <!-- 快捷按钮 -->
          <div class="flex gap-1.5 mb-2 flex-wrap">
            <button
              v-for="opt in QUICK_TIME_OPTIONS"
              :key="opt.key"
              type="button"
              class="px-2.5 py-1 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 hover:bg-hover hover:text-text"
              @click="handleQuickTime(opt.key)"
            >
              {{ opt.label }}
            </button>
          </div>

          <!-- 时间戳输入 -->
          <div class="flex flex-col gap-1 mb-3">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入时间戳</label>
            <div class="relative">
              <input
                v-model="timestampInput"
                class="w-full px-4 py-2 pr-20 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
                placeholder="例如：1700000000000（毫秒）或 1700000000（秒）"
                :aria-describedby="tsErrorMsg ? 'ts-error' : undefined"
              />
              <button
                type="button"
                class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-xs font-sans text-muted rounded-sm transition-colors duration-150 focus:outline-none focus:text-accent"
                title="填入当前时间戳"
                @click="fillNow"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>当前</span>
              </button>
            </div>
          </div>
          <p
            v-if="tsErrorMsg"
            id="ts-error"
            class="text-error text-[0.8125rem] m-0 mb-4"
          >
            {{ tsErrorMsg }}
          </p>

          <!-- 日期输入 -->
          <div class="flex flex-col gap-1 mb-3">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入日期时间</label>
            <div class="flex items-stretch gap-2">
              <input
                v-model="dateInput"
                class="flex-1 px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
                placeholder="yyyy/MM/dd HH:mm:ss"
                :aria-describedby="dateErrorMsg ? 'date-error' : undefined"
              />
              <button
                type="button"
                class="px-3 py-2 border border-border rounded-sm bg-card text-text hover:bg-hover transition-[background-color] duration-150 focus:outline-none focus:text-accent"
                aria-label="打开日期选择器"
                @click="openDatePicker"
              >
                📅
              </button>
              <input
                ref="datePickerRef"
                type="datetime-local"
                class="sr-only"
                aria-hidden="true"
                tabindex="-1"
                :value="pickerValue"
                @input="onPickerInput"
              />
            </div>
          </div>
          <p
            v-if="dateErrorMsg"
            id="date-error"
            class="text-error text-[0.8125rem] m-0 mb-4"
          >
            {{ dateErrorMsg }}
          </p>
        </section>
      </template>

      <template #output>
        <section>
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-muted m-0 uppercase tracking-wide">转换结果</h3>
              <SelectListbox
                v-model="convertTimezone"
                :options="TIMEZONES"
                class="w-32"
              />
            </div>

            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="text-xs text-muted shrink-0">自定义格式：</span>
              <input
                v-model="customFormatStr"
                class="flex-1 min-w-0 px-2 py-1 border border-border rounded-sm text-xs font-mono text-text bg-surface box-border focus:outline-none focus:border-accent"
                placeholder="YYYY-MM-DD HH:mm:ss"
              />
            </div>

            <template v-if="unifiedResult">
              <div
                v-for="field in unifiedResultFields"
                :key="field.label"
                class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card"
              >
                <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">{{ field.label }}</span>
                <code class="flex-1 font-mono text-[0.8125rem] text-text select-all break-all">{{ field.value }}</code>
                <CopyButton
                  :text="field.value"
                  label="复制"
                  class="px-2 py-1 text-xs shrink-0"
                />
              </div>
            </template>

            <div v-else class="flex items-center justify-center px-4 py-8 border border-border rounded-sm bg-card">
              <p class="text-muted text-[0.8125rem] m-0">在左侧输入时间戳或日期以查看转换结果</p>
            </div>
          </div>
        </section>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
