<script setup lang="ts">
/**
 * 正则表达式工具主组件。
 *
 * 左栏输入正则、切换 6 个标志位、提供常用正则速查表（一键填入）；
 * 右栏输入测试文本，实时高亮所有匹配并列出每个匹配的区间与捕获组。
 *
 * 大文本（>50KB）通过 Web Worker 异步匹配，避免灾难性正则阻塞主线程。
 * 错误以中文内联显示，复制/清空通过 CustomEvent('toast') 反馈。
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import {
  compileRegex,
  runMatch,
  buildSegments,
  formatRegexLiteral,
  WORKER_THRESHOLD,
  MAX_MATCHES,
  type RegexMatch,
  type RegexSegment,
  type RegexWorkerResponse,
} from '../../utils/regex/regex-engine';

// ---- 常量 ----

/** 示例正则（带命名捕获组，开页即有高亮效果） */
const EXAMPLE_PATTERN = '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})';

/** 示例测试文本 */
const EXAMPLE_TEXT = [
  '项目里程碑：',
  '2026-06-17 发布 P1 阶段第一项（正则表达式工具）',
  '2026-07-01 启动颜色工具',
  '联系人邮箱：alice@example.com，电话 13800138000',
  '官网 https://tools.openbong.cloud 已上线',
].join('\n');

/** 防抖延迟（毫秒），避免连续输入触发频繁匹配 */
const DEBOUNCE_MS = 300;

/** Worker 超时阈值（毫秒），超过则提示用户输入可能引发 ReDoS */
const WORKER_TIMEOUT_MS = 3000;

/**
 * 标志位定义。
 *
 * 顺序与 RFC 一致：g / i / m / s / u / y。
 */
interface FlagDef {
  /** 标志字符 */
  flag: string;
  /** 中文名 */
  label: string;
  /** 说明 */
  hint: string;
}

const FLAG_DEFS: FlagDef[] = [
  { flag: 'g', label: '全局', hint: '匹配所有结果，而非首个' },
  { flag: 'i', label: '忽略大小写', hint: '大小写不敏感' },
  { flag: 'm', label: '多行', hint: '^ $ 匹配每行边界' },
  { flag: 's', label: 'dotAll', hint: '. 可匹配换行符' },
  { flag: 'u', label: 'Unicode', hint: '启用 Unicode 码点模式' },
  { flag: 'y', label: '粘滞', hint: '从 lastIndex 精确匹配' },
];

/**
 * 常用正则速查表。
 *
 * 点击后一键填入正则框，并自动适配标志位。pattern 不含分隔符。
 */
interface QuickRegex {
  /** 显示名 */
  name: string;
  /** 正则 pattern（不含分隔符） */
  pattern: string;
  /** 推荐标志位 */
  flags: string;
  /** 说明 */
  hint: string;
}

const QUICK_REGEX: QuickRegex[] = [
  { name: '邮箱', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'g', hint: '匹配标准邮箱地址' },
  { name: '手机号', pattern: '1[3-9]\\d{9}', flags: 'g', hint: '中国大陆 11 位手机号' },
  { name: 'URL', pattern: 'https?://[\\w\\-.]+(:\\d+)?(/[^\\s]*)?', flags: 'g', hint: '匹配 http(s) URL' },
  { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g', hint: '匹配 IPv4 地址（未校验范围）' },
  { name: 'IPv6', pattern: '(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}', flags: 'g', hint: '匹配全格式 IPv6 地址' },
  { name: '身份证号', pattern: '\\b[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]\\b', flags: 'g', hint: '18 位身份证号（宽松）' },
  { name: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g', hint: 'YYYY-MM-DD 日期' },
  { name: '十六进制色值', pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b', flags: 'g', hint: 'CSS 颜色 hex 值' },
];

// ---- 状态 ----

/** 正则 pattern 输入（默认填入示例） */
const pattern = ref(EXAMPLE_PATTERN);
/** 标志位开关映射 */
const flagState = ref<Record<string, boolean>>({
  g: true,
  i: false,
  m: false,
  s: false,
  u: false,
  y: false,
});
/** 测试文本（默认填入示例） */
const testText = ref(EXAMPLE_TEXT);

/** 当前匹配列表 */
const matches = ref<RegexMatch[]>([]);
/** 编译错误（中文） */
const compileError = ref('');
/** 运行时错误（中文） */
const runtimeError = ref('');
/** 是否正在 Worker 匹配中 */
const isLoading = ref(false);
/** 是否因匹配数过多被截断 */
const truncated = ref(false);

/** Worker 实例 */
let worker: Worker | null = null;
/** 防抖定时器 */
let matchTimer: ReturnType<typeof setTimeout> | null = null;
/** Worker 请求序列号（丢弃过期响应） */
let matchSeq = 0;
/** Worker 超时定时器 */
let workerTimeout: ReturnType<typeof setTimeout> | null = null;
/** 正则输入框 ref（自动聚焦） */
const patternInput = ref<HTMLTextAreaElement | null>(null);

// ---- 计算属性 ----

/** 当前生效的标志位字符串 */
const flagsString = computed(() =>
  FLAG_DEFS.filter((f) => flagState.value[f.flag])
    .map((f) => f.flag)
    .join(''),
);

/** 可粘贴的正则字面量文本（用于「复制正则」按钮） */
const regexLiteral = computed(() => formatRegexLiteral(pattern.value, flagsString.value));

/** 测试文本的分段（用于高亮渲染） */
const segments = computed<RegexSegment[]>(() => {
  if (compileError.value || runtimeError.value || matches.value.length === 0) {
    return [{ text: testText.value, matched: false, match: null }];
  }
  return buildSegments(testText.value, matches.value);
});

/** 匹配结果摘要（用于「复制结果」按钮） */
const resultSummary = computed(() => {
  if (compileError.value) return `错误：${compileError.value}`;
  if (runtimeError.value) return `错误：${runtimeError.value}`;
  if (matches.value.length === 0) return '无匹配';
  const lines = matches.value.map((m, i) => {
    const parts = [`#${i + 1} "${m.match}" @ ${m.index}-${m.end}`];
    const named = Object.entries(m.namedGroups);
    if (m.groups.length > 0 || named.length > 0) {
      const groupParts: string[] = [];
      m.groups.forEach((g, idx) => {
        groupParts.push(`$${idx + 1}=${g ?? ''}`);
      });
      named.forEach(([k, v]) => groupParts.push(`${k}=${v}`));
      parts.push(`  [${groupParts.join(', ')}]`);
    }
    return parts.join('\n');
  });
  return lines.join('\n');
});

// ---- 核心操作 ----

/** 重置结果状态 */
function resetResult(): void {
  matches.value = [];
  compileError.value = '';
  runtimeError.value = '';
  truncated.value = false;
}

/** 触发匹配（带防抖） */
function scheduleMatch(): void {
  if (matchTimer !== null) clearTimeout(matchTimer);
  matchTimer = setTimeout(() => {
    void doMatch();
  }, DEBOUNCE_MS);
}

/** 执行匹配（按文本大小选择主线程 / Worker） */
async function doMatch(): Promise<void> {
  // 新一轮匹配：自增 seq，使所有在途 Worker 响应失效
  matchSeq++;

  // 空正则 + 空文本时清空结果但不报错
  if (!pattern.value && !testText.value) {
    resetResult();
    return;
  }

  // 先在主线程编译（编译错误主线程就能给出精准中文提示）
  const compiled = compileRegex(pattern.value, flagsString.value);
  if (!compiled.ok) {
    resetResult();
    compileError.value = compiled.error;
    return;
  }

  const size = new TextEncoder().encode(testText.value).length;
  if (size > WORKER_THRESHOLD) {
    await matchWithWorker(compiled.re.source, compiled.re.flags);
  } else {
    matchSync(compiled.re);
  }
}

/** 主线程同步匹配 */
function matchSync(re: RegExp): void {
  resetResult();
  try {
    const result = runMatch(re, testText.value);
    truncated.value = result.length >= MAX_MATCHES;
    matches.value = result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtimeError.value = `匹配过程中发生错误：${msg}`;
  }
}

/** Worker 异步匹配（带超时保护） */
async function matchWithWorker(patternStr: string, flagsStr: string): Promise<void> {
  if (!worker) initWorker();

  resetResult();
  isLoading.value = true;
  const seq = matchSeq;

  // 超时保护：超过阈值视为 ReDoS 嫌疑
  if (workerTimeout) clearTimeout(workerTimeout);
  workerTimeout = setTimeout(() => {
    if (seq !== matchSeq) return;
    isLoading.value = false;
    runtimeError.value =
      '正则执行超过 3 秒未返回，疑似灾难性回溯（ReDoS）。请简化正则或缩短测试文本。';
    // 终止当前 Worker，强制中断正在进行的匹配
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }, WORKER_TIMEOUT_MS);

  await new Promise<void>((resolve) => {
    if (!worker) {
      isLoading.value = false;
      runtimeError.value = 'Worker 初始化失败，请刷新页面重试';
      resolve();
      return;
    }

    worker.onmessage = (e: MessageEvent<RegexWorkerResponse>) => {
      // 过期响应：丢弃，不更新 UI
      if (e.data.seq !== matchSeq) {
        resolve();
        return;
      }
      if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
      }
      isLoading.value = false;
      const resp = e.data;
      if (!resp.ok) {
        runtimeError.value = resp.error;
        resolve();
        return;
      }
      truncated.value = resp.matches.length >= MAX_MATCHES;
      matches.value = resp.matches;
      resolve();
    };

    worker.onerror = () => {
      // onerror 不带 seq，用闭包 seq 近似过滤
      if (seq !== matchSeq) {
        resolve();
        return;
      }
      if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
      }
      isLoading.value = false;
      runtimeError.value = 'Worker 执行出错，请重试';
      resolve();
    };

    worker.postMessage({
      pattern: patternStr,
      flags: flagsStr,
      text: testText.value,
      seq,
    });
  });
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/regex/regex.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

// ---- 标志位与速查表 ----

/** 切换某个标志位 */
function toggleFlag(flag: string): void {
  flagState.value = { ...flagState.value, [flag]: !flagState.value[flag] };
}

/** 一键填入速查表中的正则 */
function applyQuickRegex(qr: QuickRegex): void {
  pattern.value = qr.pattern;
  // 解析目标 flags 并重置所有开关
  const next: Record<string, boolean> = { g: false, i: false, m: false, s: false, u: false, y: false };
  for (const ch of qr.flags) {
    if (ch in next) next[ch] = true;
  }
  flagState.value = next;
}

// ---- 清空 / 复制 ----

/** 清空所有输入与状态 */
function handleClear(): void {
  pattern.value = '';
  flagState.value = { g: false, i: false, m: false, s: false, u: false, y: false };
  testText.value = '';
  resetResult();
  isLoading.value = false;
}

/** 复制正则字面量到剪贴板 */
async function handleCopyRegex(): Promise<void> {
  if (!pattern.value) return;
  const ok = await copyText(regexLiteral.value);
  notifyCopy(ok, '已复制正则字面量', '复制失败，请重试');
}

/** 复制匹配结果摘要到剪贴板 */
async function handleCopyResult(): Promise<void> {
  if (matches.value.length === 0 && !compileError.value && !runtimeError.value) return;
  const ok = await copyText(resultSummary.value);
  notifyCopy(ok, '已复制匹配结果', '复制失败，请重试');
}

// ---- 工具 ----

/** 跨框架剪贴板封装（失败时发 toast） */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** 派发 toast 通知（与项目 Alpine Toast 系统对接） */
function notifyCopy(ok: boolean, successMsg: string, errorMsg: string): void {
  document.dispatchEvent(
    new CustomEvent('toast', { detail: { message: ok ? successMsg : errorMsg } }),
  );
}

// ---- 监听 ----

watch([pattern, testText, flagState], () => {
  scheduleMatch();
}, { deep: true, immediate: true });

// ---- 生命周期 ----

onMounted(() => {
  nextTick(() => {
    patternInput.value?.focus();
  });
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (matchTimer) clearTimeout(matchTimer);
  if (workerTimeout) clearTimeout(workerTimeout);
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <!-- 头部 -->
    <ToolHeader
      title="正则表达式"
      description="实时高亮匹配、查看捕获组，内置邮箱 / 手机号 / URL 等常用正则速查表"
      :show-example="false"
    />

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 左栏：正则输入 + 标志位 + 速查表 -->
      <template #input>
        <div class="flex flex-col gap-4">
          <!-- 正则输入 -->
          <CodePanel label="正则表达式" showClear @clear="handleClear">
            <div class="p-3">
              <textarea
                ref="patternInput"
                v-model="pattern"
                class="w-full h-24 p-2 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus:border-accent"
                placeholder="输入正则表达式，如 \d+ 或 (?<year>\d{4})"
                spellcheck="false"
                aria-label="正则表达式输入"
                aria-describedby="regex-error"
              />
              <!-- 编译错误内联提示 -->
              <div v-if="compileError" id="regex-error" class="mt-1 text-[0.75rem] text-error" role="alert">
                {{ compileError }}
              </div>
              <!-- 当前生效的字面量预览 -->
              <div v-else class="mt-1 text-[0.75rem] text-muted font-mono break-all">
                {{ regexLiteral }}
              </div>
            </div>
          </CodePanel>

          <!-- 标志位 -->
          <div class="border border-border rounded-sm bg-card p-3">
            <div class="text-[0.8125rem] text-muted mb-2">标志位</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="fdef in FLAG_DEFS"
                :key="fdef.flag"
                type="button"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-sm transition-[background-color,border-color,color] duration-150 cursor-pointer focus:outline-none',
                  flagState[fdef.flag]
                    ? 'bg-accent text-white border-accent'
                    : 'bg-card text-muted border-border hover:bg-hover hover:text-text',
                ]"
                :aria-pressed="flagState[fdef.flag]"
                :title="fdef.hint"
                @click="toggleFlag(fdef.flag)"
              >
                <span class="font-mono font-semibold">{{ fdef.flag }}</span>
                <span>{{ fdef.label }}</span>
              </button>
            </div>
          </div>

          <!-- 速查表 -->
          <div class="border border-border rounded-sm bg-card p-3">
            <div class="text-[0.8125rem] text-muted mb-2">常用正则速查表（点击填入）</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="qr in QUICK_REGEX"
                :key="qr.name"
                type="button"
                class="px-3 py-1.5 rounded-sm border border-border bg-card text-text text-sm hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150 cursor-pointer focus:outline-none"
                :title="qr.hint"
                @click="applyQuickRegex(qr)"
              >
                {{ qr.name }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- 右栏：测试文本 + 高亮 + 结果列表 -->
      <template #output>
        <div class="flex flex-col gap-4">
          <!-- 测试文本输入 + 高亮预览 -->
          <CodePanel label="测试文本（实时高亮）">
            <textarea
              v-model="testText"
              class="w-full h-44 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus:border-accent"
              placeholder="输入或粘贴要测试的文本..."
              spellcheck="false"
              aria-label="测试文本输入"
            />
          </CodePanel>

          <!-- 高亮预览 -->
          <div class="border border-border rounded-sm bg-card overflow-hidden">
            <div class="flex items-center justify-between px-4 py-1.5 border-b border-border">
              <span class="text-[0.8125rem] text-muted">高亮预览</span>
              <span class="text-[0.75rem] text-muted">
                {{ matches.length }} 个匹配<span v-if="truncated">（已截断）</span>
              </span>
            </div>
            <div class="p-3 max-h-60 overflow-auto">
              <!-- 加载中 -->
              <div v-if="isLoading" class="text-sm text-muted py-4 text-center">
                正在大文本中匹配...
              </div>
              <!-- 运行时错误 -->
              <div v-else-if="runtimeError" class="text-sm text-error py-2" role="alert">
                {{ runtimeError }}
              </div>
              <!-- 高亮分段 -->
              <pre
                v-else
                class="m-0 text-sm font-mono whitespace-pre-wrap break-all leading-relaxed text-text"
              ><span
                  v-for="(seg, i) in segments"
                  :key="i"
                  :class="seg.matched ? 'bg-accent/20 text-accent rounded-sm px-0.5' : ''"
                >{{ seg.text }}</span></pre>
            </div>
          </div>

          <!-- 匹配结果列表 -->
          <div class="border border-border rounded-sm bg-card overflow-hidden">
            <div class="flex items-center justify-between px-4 py-1.5 border-b border-border">
              <span class="text-[0.8125rem] text-muted">匹配详情</span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="px-2 py-1 rounded-sm border border-border text-[0.75rem] text-muted hover:bg-hover hover:text-text transition-[background-color] duration-150 cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!pattern"
                  title="复制正则字面量"
                  @click="handleCopyRegex"
                >
                  复制正则
                </button>
                <button
                  type="button"
                  class="px-2 py-1 rounded-sm border border-border text-[0.75rem] text-muted hover:bg-hover hover:text-text transition-[background-color] duration-150 cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="matches.length === 0 && !compileError && !runtimeError"
                  title="复制匹配结果"
                  @click="handleCopyResult"
                >
                  复制结果
                </button>
              </div>
            </div>
            <div class="max-h-72 overflow-auto">
              <!-- 空状态 -->
              <div
                v-if="!compileError && !runtimeError && matches.length === 0"
                class="text-sm text-muted py-6 text-center"
              >
                暂无匹配
              </div>
              <!-- 匹配列表 -->
              <ul v-else class="list-none m-0 p-0 divide-y divide-border">
                <li
                  v-for="(m, i) in matches"
                  :key="i"
                  class="px-4 py-2.5"
                >
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-[0.75rem] text-muted font-mono shrink-0">#{{ i + 1 }}</span>
                    <span class="text-sm font-mono text-text break-all bg-accent/20 text-accent rounded-sm px-1">{{ m.match || '(空匹配)' }}</span>
                    <span class="text-[0.75rem] text-muted font-mono">{{ m.index }}-{{ m.end }}</span>
                  </div>
                  <!-- 捕获组 -->
                  <div
                    v-if="m.groups.length > 0 || Object.keys(m.namedGroups).length > 0"
                    class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1"
                  >
                    <span
                      v-for="(g, gi) in m.groups"
                      :key="`g-${gi}`"
                      class="text-[0.75rem] font-mono text-muted"
                    >
                      ${{ gi + 1 }} =
                      <span class="text-text">{{ g === undefined ? '(未参与)' : g === '' ? '(空串)' : g }}</span>
                    </span>
                    <span
                      v-for="(v, k) in m.namedGroups"
                      :key="`n-${k}`"
                      class="text-[0.75rem] font-mono text-muted"
                    >
                      {{ k }} =
                      <span class="text-text">{{ v }}</span>
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
