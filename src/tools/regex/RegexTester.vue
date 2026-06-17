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

/**
 * 正则语法参考条目（「正则语法参考」区块表格的一行）。
 */
interface SyntaxEntry {
  /** 语法符号，如 `\d`、`(?<name>...)` */
  symbol: string;
  /** 含义说明 */
  meaning: string;
  /** 用法示例 */
  example: string;
}

/**
 * 正则语法参考分组（对应一个卡片）。
 */
interface SyntaxGroup {
  /** 卡片标题 */
  title: string;
  /** 条目列表 */
  entries: SyntaxEntry[];
  /** 卡片底部补充说明（可选） */
  note?: string;
}

/**
 * 正则语法参考分组数据，按常用程度排序。
 *
 * 供页面底部「正则语法参考」区块做数据驱动渲染，覆盖字符类、量词、锚点、
 * 分组、断言、转义六类常用语法。深度概念解释见 FAQ，此处只做速查。
 */
const SYNTAX_GROUPS: SyntaxGroup[] = [
  {
    title: '字符与字符类',
    entries: [
      { symbol: '.', meaning: '匹配任意单个字符（默认不含换行；勾选 s 标志后含换行）', example: 'a.c → abc、axc' },
      { symbol: '[abc]', meaning: '字符集合，匹配其中任意一个字符', example: '[aeiou] 匹配元音' },
      { symbol: '[^abc]', meaning: '否定集合，匹配不在其中的任意字符', example: '[^0-9] 匹配非数字' },
      { symbol: '[a-z]', meaning: '字符范围，可组合多个范围', example: '[a-zA-Z] 匹配所有字母' },
      { symbol: '\\d  \\D', meaning: '数字 / 非数字', example: '\\d+ 匹配 123' },
      { symbol: '\\w  \\W', meaning: '单词字符（字母、数字、下划线）/ 非单词字符', example: '\\w+ 匹配 hello_1' },
      { symbol: '\\s  \\S', meaning: '空白符（空格、制表、换行等）/ 非空白符', example: '\\s+ 匹配连续空白' },
    ],
  },
  {
    title: '量词（重复次数）',
    entries: [
      { symbol: '*', meaning: '0 次或多次', example: 'ab*c → ac、abbc' },
      { symbol: '+', meaning: '1 次或多次', example: 'ab+c → abc、abbc' },
      { symbol: '?', meaning: '0 次或 1 次（可选）', example: 'colou?r → color、colour' },
      { symbol: '{n}', meaning: '恰好 n 次', example: '\\d{4} 匹配 4 位数字' },
      { symbol: '{n,}', meaning: '至少 n 次', example: '\\d{2,} 匹配 2 位及以上' },
      { symbol: '{n,m}', meaning: 'n 到 m 次', example: '\\d{1,3} 匹配 1~3 位' },
      { symbol: '*?  +?  ??  {n,m}?', meaning: '非贪婪（懒惰）模式，尽可能少地匹配', example: '<.*?> 最短匹配标签' },
    ],
  },
  {
    title: '锚点与边界（不消耗字符）',
    entries: [
      { symbol: '^', meaning: '字符串开头；勾选 m 标志后匹配每行开头', example: '^Hello' },
      { symbol: '$', meaning: '字符串结尾；勾选 m 标志后匹配每行结尾', example: 'world$' },
      { symbol: '\\b', meaning: '单词边界（单词与空格 / 标点之间）', example: '\\bcat\\b 不匹配 category' },
      { symbol: '\\B', meaning: '非单词边界', example: '\\Bcat 匹配 scattered 中的 cat' },
    ],
  },
  {
    title: '分组与反向引用',
    entries: [
      { symbol: '(abc)', meaning: '捕获组，按左括号顺序编号为 $1、$2…', example: '(\\d+)-(\\d+) 取 $1、$2' },
      { symbol: '(?:abc)', meaning: '非捕获组，不计入编号', example: '(?:ab)+ 重复 ab 不占编号' },
      { symbol: '(?<name>abc)', meaning: '命名捕获组，通过 groups.name 取值', example: '(?<year>\\d{4})' },
      { symbol: '\\1  \\2', meaning: '反向引用第 n 个捕获组（匹配与之相同的内容）', example: '(\\w)\\1 匹配 aa、bb' },
      { symbol: '\\k<name>', meaning: '反向引用命名捕获组', example: '(?<x>\\d)-\\k<x> 匹配 5-5' },
    ],
  },
  {
    title: '零宽断言（环视，不消耗字符）',
    entries: [
      { symbol: '(?=pattern)', meaning: '先行肯定：右侧必须匹配', example: '\\d+(?=元) 匹配「100元」中的 100' },
      { symbol: '(?!pattern)', meaning: '先行否定：右侧不能匹配', example: '\\d+(?!元) 匹配后非「元」的数字' },
      { symbol: '(?<=pattern)', meaning: '后行肯定：左侧必须匹配', example: '(?<=￥)\\d+ 匹配「￥100」中的 100' },
      { symbol: '(?<!pattern)', meaning: '后行否定：左侧不能匹配', example: '(?<!￥)\\d+ 匹配前非「￥」的数字' },
    ],
    note: '四种断言的概念与区别详见页面底部 FAQ「什么是先行断言和后行断言」。',
  },
  {
    title: '特殊字符转义',
    entries: [
      { symbol: '\\.', meaning: '匹配字面量「.」（让元字符还原为普通字符）', example: 'example\\.com' },
      { symbol: '\\(  \\)', meaning: '匹配字面量括号', example: '匹配 (1) 写作 \\(\\d+\\)' },
      { symbol: '\\$', meaning: '匹配字面量美元符', example: 'price\\$10' },
      { symbol: '\\/  \\|', meaning: '匹配字面量斜杠、竖线', example: 'a\\/b、a\\|b' },
    ],
    note: '需转义的元字符：. ^ $ * + ? ( ) [ ] { } | / 以及反斜杠本身。本工具输入框直接写 \\ 即可，无需像 JS 字符串那样双重转义。',
  },
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

        </div>
      </template>
    </ResponsiveWorkspace>

    <!-- 匹配详情（独立全宽，与上方双栏工作区等宽对齐） -->
    <div class="mt-4">
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

    <!-- 正则语法参考（全宽，与上方工作区等宽对齐） -->
    <section class="mt-6 pb-8">
      <h2 class="text-sm font-semibold text-text mb-3">正则语法参考</h2>

      <!-- 概述 -->
      <div class="bg-card border border-border rounded-sm p-4 mb-4">
        <p class="text-sm text-text m-0">
          正则表达式由<strong>普通字符</strong>和<strong>元字符</strong>组成：普通字符匹配自身，元字符具有特殊含义。要匹配元字符的字面量，在前面加 <code class="font-mono text-accent">\</code> 转义。本工具支持全部标志位、命名捕获组与零宽断言等现代 ECMAScript 正则特性。
        </p>
      </div>

      <!-- 各语法类别卡片（数据驱动） -->
      <div
        v-for="group in SYNTAX_GROUPS"
        :key="group.title"
        class="bg-card border border-border rounded-sm p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-text m-0 mb-3">{{ group.title }}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-2 pr-4 font-medium text-muted">符号</th>
                <th class="text-left py-2 pr-4 font-medium text-muted">含义</th>
                <th class="text-left py-2 font-medium text-muted">示例</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in group.entries"
                :key="entry.symbol"
                class="border-b border-border/50"
              >
                <td class="py-2 pr-4 font-mono text-text font-medium whitespace-nowrap">{{ entry.symbol }}</td>
                <td class="py-2 pr-4 text-text">{{ entry.meaning }}</td>
                <td class="py-2 font-mono text-muted">{{ entry.example }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="group.note" class="text-[0.8125rem] text-muted m-0 mt-3">
          {{ group.note }}
        </p>
      </div>

      <!-- 标志位速查（复用 FLAG_DEFS，呼应上方开关） -->
      <div class="bg-card border border-border rounded-sm p-4 mb-4">
        <h3 class="text-sm font-semibold text-text m-0 mb-3">标志位速查（对应上方开关）</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-2 pr-4 font-medium text-muted">标志</th>
                <th class="text-left py-2 pr-4 font-medium text-muted">名称</th>
                <th class="text-left py-2 font-medium text-muted">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="fdef in FLAG_DEFS"
                :key="fdef.flag"
                class="border-b border-border/50"
              >
                <td class="py-2 pr-4 font-mono text-accent font-semibold">{{ fdef.flag }}</td>
                <td class="py-2 pr-4 text-text">{{ fdef.label }}</td>
                <td class="py-2 text-muted">{{ fdef.hint }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>
