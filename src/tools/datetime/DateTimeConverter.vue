<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  getLiveClockInfo,
  getQuickTimestamp,
  formatCustom,
  TIMEZONES,
  QUICK_TIME_OPTIONS,
  type DateInfo,
  type QuickTimeType,
} from '../../utils/datetime/datetime';

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
const isPaused = ref(false);
let liveTimer: ReturnType<typeof setInterval> | null = null;

function updateLiveClock() {
  if (!isPaused.value) {
    liveClock.value = getLiveClockInfo(liveTimezone.value);
  }
}

function togglePause() {
  isPaused.value = !isPaused.value;
  if (!isPaused.value) {
    liveClock.value = getLiveClockInfo(liveTimezone.value);
  }
}

watch(liveTimezone, () => {
  if (isMounted.value) {
    liveClock.value = getLiveClockInfo(liveTimezone.value);
  }
});

onMounted(() => {
  isMounted.value = true;
  updateLiveClock();
  liveTimer = setInterval(updateLiveClock, 1000);
  // 默认展示结果：用当前时间预填充两个转换区
  timestampInput.value = String(Date.now());
  parseTimestamp();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  dateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
});

onUnmounted(() => {
  if (liveTimer) clearInterval(liveTimer);
});

// ─── 时间戳 → 日期 ───
const timestampInput = ref('');
const tsDateInfo = ref<DateInfo | null>(null);
const tsErrorMsg = ref('');
const convertTimezone = ref('local');
const customFormatStr = ref('YYYY-MM-DD HH:mm:ss');

watch([convertTimezone, customFormatStr], () => {
  if (tsDateInfo.value) {
    const ts = tsDateInfo.value.unixMillis;
    tsDateInfo.value = timestampToDateInfo(ts, convertTimezone.value, customFormatStr.value);
  }
});

function parseTimestamp() {
  tsErrorMsg.value = '';
  tsDateInfo.value = null;
  const input = timestampInput.value.trim();
  if (!input) { tsErrorMsg.value = '请输入时间戳'; return; }
  const unit = detectTimestampUnit(input);
  if (!unit) { tsErrorMsg.value = '无法识别时间戳格式，请输入 10 位（秒）或 13 位（毫秒）数字'; return; }
  const ts = Number(input);
  tsDateInfo.value = timestampToDateInfo(unit === 's' ? ts * 1000 : ts, convertTimezone.value, customFormatStr.value);
}

function fillNow() {
  timestampInput.value = String(Date.now());
  parseTimestamp();
}

function handleQuickTime(type: QuickTimeType) {
  timestampInput.value = String(getQuickTimestamp(type));
  parseTimestamp();
}

function clearTimestamp() {
  timestampInput.value = '';
  tsDateInfo.value = null;
  tsErrorMsg.value = '';
}

// ─── 日期 → 时间戳 ───
const dateInput = ref('');
const dateOutput = ref<{ unixMillis: number; unixSeconds: number } | null>(null);
const dateErrorMsg = ref('');

watch(dateInput, () => {
  const input = dateInput.value.trim();
  if (!input) {
    dateOutput.value = null;
    dateErrorMsg.value = '';
    return;
  }
  const result = parseDateInput(input);
  if (result) {
    dateOutput.value = { unixMillis: result.unixMillis, unixSeconds: result.unixSeconds };
    dateErrorMsg.value = '';
  } else {
    dateOutput.value = null;
    dateErrorMsg.value = '无法解析日期，请检查格式';
  }
});

function clearDateInput() {
  dateInput.value = '';
  dateOutput.value = null;
  dateErrorMsg.value = '';
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

const tsResultFields = computed(() => {
  if (!tsDateInfo.value) return [];
  const fields = [
    { label: 'ISO 8601', value: tsDateInfo.value.iso },
    { label: '本地时间', value: tsDateInfo.value.local },
    { label: 'UTC 时间', value: tsDateInfo.value.utc },
  ];
  if (convertTimezone.value !== 'local') {
    const tzLabel = TIMEZONES.find(t => t.value === convertTimezone.value)?.label ?? '时区时间';
    fields.push({ label: tzLabel, value: tsDateInfo.value.tzTime });
  }
  fields.push(
    { label: 'RFC 2822', value: tsDateInfo.value.rfc2822 },
    { label: '相对时间', value: tsDateInfo.value.relative },
  );
  return fields;
});

const customPreview = computed(() => {
  if (!tsDateInfo.value) return '';
  return formatCustom(tsDateInfo.value.unixMillis, customFormatStr.value);
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader title="日期时间转换器" description="时间戳与日期格式互转，支持时区与自定义格式" :show-example="false" />

    <!-- ═══ 实时时钟区（通栏，保持完整垂直列表） ═══ -->
    <section class="mb-6 p-4 border border-border rounded-md bg-card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">⏱</span> 当前时间
        </h2>
        <div class="flex items-center gap-2">
          <SelectListbox
            v-model="liveTimezone"
            :options="TIMEZONES"
            class="w-32"
          />
          <button
            class="px-3 py-1 border border-border rounded-sm text-xs font-sans cursor-pointer transition-colors duration-150"
            :class="isPaused ? 'bg-accent text-white border-accent' : 'bg-card text-text hover:bg-hover'"
            @click="togglePause"
          >
            {{ isPaused ? '▶ 恢复' : '⏸ 暂停' }}
          </button>
        </div>
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
        <!-- 时间戳 → 日期（输入区） -->
        <section class="mb-6">
          <h2 class="text-sm font-semibold m-0 mb-3 text-text">🔄 时间戳 → 日期</h2>

          <div class="flex flex-col gap-1 mb-3">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入时间戳</label>
            <input
              v-model="timestampInput"
              class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              placeholder="例如：1700000000000（毫秒）或 1700000000（秒）"
              @keyup.enter="parseTimestamp"
            />
          </div>

          <div class="flex gap-2 items-center mb-3 flex-wrap">
            <button
              class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
              @click="parseTimestamp"
            >
              转换
            </button>
            <button
              class="px-6 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans cursor-pointer hover:bg-hover"
              @click="fillNow"
            >
              当前时间
            </button>
            <ClearButton @clear="clearTimestamp" />
          </div>

          <div class="flex gap-1.5 mb-4 flex-wrap">
            <button
              v-for="opt in QUICK_TIME_OPTIONS"
              :key="opt.key"
              class="px-2.5 py-1 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 hover:bg-hover hover:text-text"
              @click="handleQuickTime(opt.key)"
            >
              {{ opt.label }}
            </button>
          </div>

          <p v-if="tsErrorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ tsErrorMsg }}</p>
        </section>

        <!-- 日期 → 时间戳（输入区） -->
        <section>
          <h2 class="text-sm font-semibold m-0 mb-3 text-text">📅 日期 → 时间戳</h2>

          <div class="flex flex-col gap-1 mb-3">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[0.8125rem] text-muted font-medium">输入日期时间</label>
              <ClearButton @clear="clearDateInput" />
            </div>
            <input
              v-model="dateInput"
              class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              placeholder="例如：2023-11-14T12:00:00 或 2023/11/14 12:00:00"
            />
            <input
              v-model="dateInput"
              type="datetime-local"
              class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              step="1"
            />
          </div>

          <p v-if="dateErrorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ dateErrorMsg }}</p>
        </section>
      </template>

      <template #output>
        <!-- 时间戳 → 日期（结果区） -->
        <section class="mb-6">
          <div v-if="tsResultFields.length" class="flex flex-col gap-1">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-muted m-0 uppercase tracking-wide">转换结果</h3>
              <SelectListbox
                v-model="convertTimezone"
                :options="TIMEZONES"
                class="w-32"
              />
            </div>

            <div
              v-for="field in tsResultFields"
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

            <!-- 自定义格式 -->
            <div class="px-4 py-2 border border-border rounded-sm bg-card mt-1">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-accent">自定义格式</span>
                <CopyButton
                  :text="customPreview"
                  label="复制"
                  class="px-2 py-1 text-xs shrink-0"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted shrink-0">格式：</span>
                  <input
                    v-model="customFormatStr"
                    class="flex-1 px-2 py-1 border border-border rounded-sm text-xs font-mono text-text bg-surface box-border focus:outline-none focus:border-accent"
                    placeholder="YYYY-MM-DD HH:mm:ss"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted shrink-0">结果：</span>
                  <code class="flex-1 font-mono text-[0.8125rem] text-text select-all break-all">{{ customPreview }}</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 日期 → 时间戳（结果区） -->
        <section>
          <div v-if="dateOutput" class="flex flex-col gap-1">
            <div class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">Unix 毫秒</span>
              <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ dateOutput.unixMillis }}</code>
              <CopyButton
                :text="String(dateOutput.unixMillis)"
                label="复制"
                class="px-2 py-1 text-xs shrink-0"
              />
            </div>
            <div class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">Unix 秒</span>
              <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ dateOutput.unixSeconds }}</code>
              <CopyButton
                :text="String(dateOutput.unixSeconds)"
                label="复制"
                class="px-2 py-1 text-xs shrink-0"
              />
            </div>
          </div>
        </section>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
