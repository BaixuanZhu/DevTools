<script setup lang="ts">
/**
 * PBKDF2 密钥派生工具页主组件（本工具私有）。
 *
 * 两段式布局（同 BcryptTool）：派生区 + border-t 分隔的 Django 哈希校验区。
 * PBKDF2 六十万级迭代为百毫秒级慢计算，交互为按钮触发而非键入即算
 * （DESIGN.md 慢操作例外）：派生/校验请求经 reqId 递增编号，回包 reqId 与
 * 当前序号不一致即丢弃；输入变化后既有结果弱化并提示"输入已变化"（计算期间
 * 改输入的时序由回包时的输入快照比对兜底）。派生在 Web Worker 内用 Web Crypto
 * subtle 完成，零第三方依赖。派生结果以 hex 为单一权威格式，b64 展示由 UI 层
 * 纯前端转换（不重算）。
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  ITER_DEFAULT,
  DKLEN_DEFAULT,
  PRF_OPTIONS,
  parseDjangoPbkdf2Hash,
  getDjangoHashFormatError,
  validatePbkdf2Params,
  isValidHex,
  hexToBytes,
  bytesToHex,
  bytesToBase64,
  generateRandomSalt,
  type Pbkdf2Prf,
  type Pbkdf2DeriveRequest,
  type Pbkdf2VerifyDjangoRequest,
  type Pbkdf2WorkerResponse,
} from '../../utils/crypto/pbkdf2';

// ---- 派生区状态 ----

/** 待派生口令（默认示例，打开即可体验） */
const password = ref('DevTools@2026');
/** 盐编码模式（text 按 UTF-8 字节、hex 按十六进制字节参与运算） */
const saltMode = ref<'text' | 'hex'>('text');
/** 盐输入（按当前模式解释） */
const salt = ref('devtools-salt');
/** 迭代次数（默认 60 万，OWASP 2023 对 SHA-256 的推荐档） */
const iterations = ref(ITER_DEFAULT);
/** PRF 哈希算法 */
const prf = ref<Pbkdf2Prf>('SHA-256');
/** 派生长度（字节） */
const dkLen = ref(DKLEN_DEFAULT);
/** 派生结果（hex 权威格式） */
const deriveHex = ref('');
/** 结果是否已因输入变化而过期 */
const deriveStale = ref(false);
/** 结果展示格式（纯前端转换，不重算） */
const outputFormat = ref<'hex' | 'base64'>('hex');
/** 派生区错误（中文） */
const deriveError = ref('');

// ---- Django 校验区状态 ----

/**
 * 待校验 Django 哈希。默认值为实现期经 node crypto 与 Web Crypto 双实现
 * 交叉核对固化的向量（密码 DevTools@2026、盐 some-salt-16byte、迭代 100）。
 */
const djangoHash = ref(
  'pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=',
);
/** 待比对明文口令 */
const djangoPassword = ref('DevTools@2026');
/** 校验结果：match / mismatch / null（未校验） */
const djangoResult = ref<'match' | 'mismatch' | null>(null);
/** 校验结果是否已因输入变化而过期 */
const djangoStale = ref(false);
/** 校验区错误（点击触发/Worker 返回的中文错误；格式错误另行即时展示） */
const djangoError = ref('');

// ---- Worker 与请求序号 ----

/** 懒初始化的慢计算 Worker（首个按钮点击时创建） */
let worker: Worker | null = null;
/** 递增请求序号：每次发请求 +1，回包不一致即视为过期丢弃 */
let reqSeq = 0;
/** 是否有计算进行中（派生/校验共用，进行中两按钮均禁用防连点） */
const isComputing = ref(false);
/** 当前进行中的操作类别（用于按钮文案与错误归位） */
const currentOp = ref<'derive' | 'verify-django' | null>(null);
/** 进行中派生请求的输入快照（回包时与当前输入比对：计算期间改过输入则结果直接标记过期） */
let pendingDeriveInput: {
  password: string;
  salt: string;
  saltMode: 'text' | 'hex';
  iterations: number;
  prf: Pbkdf2Prf;
  dkLen: number;
} | null = null;
/** 进行中校验请求的输入快照（作用同上） */
let pendingDjangoInput: { hash: string; password: string } | null = null;

/** PRF 下拉选项 */
const prfOptions = PRF_OPTIONS.map((p) => ({ value: p, label: p }));

/** 迭代快捷档位（点击填入输入框） */
const iterPresets = [
  { value: 100_000, label: '10万' },
  { value: 300_000, label: '30万' },
  { value: 600_000, label: '60万' },
  { value: 1_000_000, label: '100万' },
];

/** 当前参数组合的中文错误（纯计算即时显示） */
const paramError = computed(() => validatePbkdf2Params(iterations.value, dkLen.value));

/** 盐的即时格式错误（仅 hex 模式校验非法字符，纯计算） */
const saltError = computed(() => {
  if (saltMode.value === 'hex' && salt.value && !isValidHex(salt.value)) {
    return '盐包含非法字符：hex 模式仅允许 0-9、a-f、A-F，且字符数必须为偶数';
  }
  return '';
});

/** 派生结果的展示文本（b64 由 hex 转换，不重算） */
const displayResult = computed(() => {
  if (!deriveHex.value) return '';
  return outputFormat.value === 'base64' ? bytesToBase64(hexToBytes(deriveHex.value)) : deriveHex.value;
});

/** 当前盐的实际字节数（提示行展示，纯计算） */
const saltByteLength = computed(() => {
  if (saltMode.value === 'hex') return isValidHex(salt.value) ? salt.value.length / 2 : 0;
  return new TextEncoder().encode(salt.value).length;
});

/** Django 哈希的即时解析结果（粘贴即显示迭代/盐长/哈希长，纯计算） */
const parsedDjango = computed(() => parseDjangoPbkdf2Hash(djangoHash.value));

/** Django 哈希的格式错误文案（空串表示合法或未输入，即时展示） */
const djangoFormatError = computed(() => getDjangoHashFormatError(djangoHash.value));

/**
 * 切换盐模式：text → hex 无损转换（UTF-8 字节转十六进制）；
 * hex → text 仅在当前值是合法 hex 且可无损解码为 UTF-8 时转换，否则原样保留。
 * @param mode - 目标模式
 */
function switchSaltMode(mode: 'text' | 'hex'): void {
  if (mode === saltMode.value) return;
  if (mode === 'hex') {
    salt.value = bytesToHex(new TextEncoder().encode(salt.value));
  } else if (isValidHex(salt.value)) {
    try {
      salt.value = new TextDecoder('utf-8', { fatal: true }).decode(hexToBytes(salt.value));
    } catch {
      // 含非法 UTF-8 序列，保留原 hex 字符串由用户自行修改
    }
  }
  saltMode.value = mode;
}

/**
 * 确保 Worker 已就绪：首个请求前懒创建并挂载消息/错误处理器。
 * @returns Worker 实例（创建失败返回 null）
 */
function ensureWorker(): Worker | null {
  if (worker) return worker;
  worker = new Worker(new URL('../../utils/crypto/pbkdf2.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (e: MessageEvent<Pbkdf2WorkerResponse>) => {
    const resp = e.data;
    if (resp.reqId !== reqSeq) return; // 过期响应丢弃
    isComputing.value = false;
    currentOp.value = null;
    if (!resp.ok) {
      if (resp.kind === 'derive') deriveError.value = resp.error;
      else djangoError.value = resp.error;
      return;
    }
    if (resp.kind === 'derive') {
      deriveHex.value = resp.hex;
      // 计算期间输入可能已变（watch 无法覆盖"回包晚于改输入"的时序），回包时以快照兜底判定过期
      const snap = pendingDeriveInput;
      pendingDeriveInput = null;
      deriveStale.value =
        snap !== null &&
        (snap.password !== password.value ||
          snap.salt !== salt.value ||
          snap.saltMode !== saltMode.value ||
          snap.iterations !== iterations.value ||
          snap.prf !== prf.value ||
          snap.dkLen !== dkLen.value);
    } else {
      djangoResult.value = resp.match ? 'match' : 'mismatch';
      const snap = pendingDjangoInput;
      pendingDjangoInput = null;
      djangoStale.value =
        snap !== null &&
        (snap.hash !== djangoHash.value.trim() || snap.password !== djangoPassword.value);
    }
  };
  worker.onerror = () => {
    const msg = 'Worker 执行出错，请刷新页面重试';
    if (currentOp.value === 'verify-django') djangoError.value = msg;
    else deriveError.value = msg;
    isComputing.value = false;
    currentOp.value = null;
  };
  return worker;
}

/** 点击「派生密钥」：校验参数与盐后下发 Worker 计算。 */
function handleDerive(): void {
  deriveError.value = '';
  if (!password.value) {
    deriveError.value = '请输入密码';
    return;
  }
  if (!salt.value) {
    deriveError.value = '请输入盐';
    return;
  }
  if (saltError.value) {
    deriveError.value = saltError.value;
    return;
  }
  if (paramError.value) {
    deriveError.value = paramError.value;
    return;
  }
  const w = ensureWorker();
  if (!w) return;
  const saltBytes =
    saltMode.value === 'hex' ? hexToBytes(salt.value) : new TextEncoder().encode(salt.value);
  reqSeq += 1;
  pendingDeriveInput = {
    password: password.value,
    salt: salt.value,
    saltMode: saltMode.value,
    iterations: iterations.value,
    prf: prf.value,
    dkLen: dkLen.value,
  };
  isComputing.value = true;
  currentOp.value = 'derive';
  const req: Pbkdf2DeriveRequest = {
    kind: 'derive',
    reqId: reqSeq,
    password: password.value,
    saltBytes,
    iterations: iterations.value,
    prf: prf.value,
    dkLen: dkLen.value,
  };
  w.postMessage(req);
}

/** 点击「校验」：先做中文格式校验，合法才下发 Worker 比对。 */
function handleDjangoVerify(): void {
  djangoError.value = '';
  djangoResult.value = null;
  djangoStale.value = false;
  if (!djangoHash.value.trim()) {
    djangoError.value = '请输入要校验的 Django 哈希';
    return;
  }
  const formatError = getDjangoHashFormatError(djangoHash.value);
  if (formatError) {
    djangoError.value = formatError;
    return;
  }
  const parsed = parseDjangoPbkdf2Hash(djangoHash.value);
  if (!parsed) {
    djangoError.value = '哈希格式无法解析，请检查后重试';
    return;
  }
  if (!djangoPassword.value) {
    djangoError.value = '请输入密码';
    return;
  }
  const w = ensureWorker();
  if (!w) return;
  const hashToSend = djangoHash.value.trim();
  reqSeq += 1;
  pendingDjangoInput = { hash: hashToSend, password: djangoPassword.value };
  isComputing.value = true;
  currentOp.value = 'verify-django';
  const req: Pbkdf2VerifyDjangoRequest = {
    kind: 'verify-django',
    reqId: reqSeq,
    password: djangoPassword.value,
    iterations: parsed.iterations,
    saltBytes: parsed.saltBytes,
    expectedBytes: parsed.hashBytes,
  };
  w.postMessage(req);
}

/** 清空派生区（口令/盐与结果一并清除；递增 reqId 使在途响应失效，不再回填） */
function handleDeriveClear(): void {
  reqSeq += 1;
  pendingDeriveInput = null;
  isComputing.value = false;
  currentOp.value = null;
  password.value = '';
  salt.value = '';
  deriveHex.value = '';
  deriveStale.value = false;
  deriveError.value = '';
}

/** 清空校验区（哈希与密码一并清除；作用同上） */
function handleDjangoClear(): void {
  reqSeq += 1;
  pendingDjangoInput = null;
  isComputing.value = false;
  currentOp.value = null;
  djangoHash.value = '';
  djangoPassword.value = '';
  djangoResult.value = null;
  djangoStale.value = false;
  djangoError.value = '';
}

/** 随机盐按钮：按当前模式生成 16 字节随机盐填入。 */
function handleRandomSalt(): void {
  salt.value = generateRandomSalt(saltMode.value);
}

// 慢计算不做键入即算：输入变化只清除旧错误并标记既有结果过期（弱化展示）。
// outputFormat 是纯展示切换（不重算），不参与 stale 判定。
watch([password, salt, saltMode, iterations, prf, dkLen], () => {
  deriveError.value = '';
  if (deriveHex.value) deriveStale.value = true;
});
watch([djangoHash, djangoPassword], () => {
  djangoError.value = '';
  if (djangoResult.value !== null) djangoStale.value = true;
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
});
</script>

<template>
  <div class="max-w-180">
    <ToolHeader
      title="PBKDF2 密钥派生"
      description="自定义盐、迭代与 PRF 派生密钥（hex/Base64 输出），在线校验 Django pbkdf2_sha256 哈希"
      :show-example="false"
    />

    <!-- 区块一：派生密钥 -->
    <h2 class="text-base font-semibold text-foreground mb-1">派生密钥</h2>
    <p class="text-[0.8125rem] text-muted-foreground mb-3">
      PBKDF2 是兼容性最广的密钥派生函数（Web Crypto 原生支持），派生结果可用于加密密钥或口令哈希。
    </p>

    <!-- 密码输入 -->
    <div class="mb-3">
      <label for="pbkdf2-password" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">密码</label>
      <input
        id="pbkdf2-password"
        v-model="password"
        type="text"
        autocomplete="off"
        spellcheck="false"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
        placeholder="输入要派生的密码"
      />
    </div>

    <!-- 盐输入：text/hex 模式切换 + 随机盐按钮 + 即时校验/字节数提示 -->
    <div class="mb-3">
      <div class="flex items-center justify-between mb-1">
        <label for="pbkdf2-salt" class="block text-[0.8125rem] text-muted-foreground font-medium">盐</label>
        <button
          type="button"
          class="text-[0.8125rem] font-sans text-muted-foreground cursor-pointer border border-border rounded-sm px-3 py-1 bg-card transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
          @click="handleRandomSalt"
        >
          随机盐（16 字节）
        </button>
      </div>
      <div class="flex gap-2">
        <input
          id="pbkdf2-salt"
          v-model="salt"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="flex-1 min-w-0 px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          :class="{ 'border-error': !!saltError }"
          :placeholder="saltMode === 'hex' ? '十六进制盐（偶数个字符，如 0123abcd）' : '文本盐（按 UTF-8 字节参与运算）'"
          :aria-invalid="!!saltError"
          :aria-describedby="saltError ? 'pbkdf2-salt-error' : 'pbkdf2-salt-info'"
        />
        <!-- 模式切换：分段控件 -->
        <div class="flex shrink-0 border border-border rounded-sm overflow-hidden" role="group" aria-label="盐输入模式">
          <button
            type="button"
            class="px-3 py-2 text-[0.8125rem] font-sans cursor-pointer transition-colors duration-150"
            :class="saltMode === 'text' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'"
            :aria-pressed="saltMode === 'text'"
            @click="switchSaltMode('text')"
          >
            文本
          </button>
          <button
            type="button"
            class="px-3 py-2 text-[0.8125rem] font-sans cursor-pointer transition-colors duration-150 border-l border-border"
            :class="saltMode === 'hex' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'"
            :aria-pressed="saltMode === 'hex'"
            @click="switchSaltMode('hex')"
          >
            Hex
          </button>
        </div>
      </div>
      <!-- 盐提示行：固定高度预留，模式/错误切换不引起布局跳动 -->
      <div class="min-h-6 mt-1 flex items-center">
        <p v-if="saltError" id="pbkdf2-salt-error" class="text-error text-xs m-0">{{ saltError }}</p>
        <p v-else id="pbkdf2-salt-info" class="text-xs text-muted-foreground m-0">当前盐共 {{ saltByteLength }} 字节</p>
      </div>
    </div>

    <!-- 迭代次数：输入 + 快捷档 -->
    <div class="mb-3">
      <label for="pbkdf2-iterations" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">迭代次数</label>
      <div class="flex items-center gap-2 flex-wrap">
        <input
          id="pbkdf2-iterations"
          v-model.number="iterations"
          type="number"
          min="1"
          max="10000000"
          step="1"
          class="w-40 px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          :aria-invalid="!!paramError"
          aria-describedby="pbkdf2-iterations-hint"
        />
        <button
          v-for="preset in iterPresets"
          :key="preset.value"
          type="button"
          class="px-3 py-2 border border-border rounded-sm bg-card text-muted-foreground text-[0.8125rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
          @click="iterations = preset.value"
        >
          {{ preset.label }}
        </button>
      </div>
      <!-- 迭代提示行：固定高度预留 -->
      <div class="min-h-6 mt-1 flex items-center" id="pbkdf2-iterations-hint" aria-live="polite">
        <p v-if="paramError && (iterations < 1 || iterations > 10000000)" class="text-error text-xs m-0">{{ paramError }}</p>
        <p v-else class="text-xs text-muted-foreground m-0">OWASP 2023 对 PBKDF2-HMAC-SHA256 推荐 60 万次迭代（1-1000 万）。</p>
      </div>
    </div>

    <!-- PRF + 派生长度 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
      <SelectListbox v-model="prf" label="PRF 哈希算法" :options="prfOptions" />
      <div>
        <label for="pbkdf2-dklen" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">派生长度（字节）</label>
        <input
          id="pbkdf2-dklen"
          v-model.number="dkLen"
          type="number"
          min="1"
          max="512"
          step="1"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          :aria-invalid="!!paramError"
          aria-describedby="pbkdf2-dklen-hint"
        />
      </div>
    </div>
    <!-- 派生长度提示行：固定高度预留 -->
    <div class="min-h-6 flex items-center mb-4" id="pbkdf2-dklen-hint" aria-live="polite">
      <p v-if="paramError && !(iterations < 1 || iterations > 10000000)" class="text-error text-xs m-0">{{ paramError }}</p>
      <p v-else class="text-xs text-muted-foreground m-0">默认 32 字节（256 位）；常用 16 / 32 / 64 字节，上限 512。</p>
    </div>

    <!-- 派生按钮 + 错误（错误与按钮同行展示，出现/消失不引起下方跳动） -->
    <div class="flex items-center gap-3 mb-3 flex-wrap">
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-sm text-[0.8125rem] font-sans cursor-pointer active:brightness-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isComputing"
        @click="handleDerive"
      >
        {{ isComputing && currentOp === 'derive' ? '派生中…' : '派生密钥' }}
      </button>
      <p v-if="deriveError" class="text-error text-[0.8125rem] m-0">{{ deriveError }}</p>
    </div>

    <!-- 输出格式切换（hex/Base64，纯前端转换不重算）+ 结果面板 -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xs text-muted-foreground">输出格式</span>
      <div class="flex border border-border rounded-sm overflow-hidden" role="group" aria-label="输出格式">
        <button
          type="button"
          class="px-3 py-1 text-xs font-sans cursor-pointer transition-colors duration-150"
          :class="outputFormat === 'hex' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'"
          :aria-pressed="outputFormat === 'hex'"
          @click="outputFormat = 'hex'"
        >
          Hex
        </button>
        <button
          type="button"
          class="px-3 py-1 text-xs font-sans cursor-pointer border-l border-border transition-colors duration-150"
          :class="outputFormat === 'base64' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'"
          :aria-pressed="outputFormat === 'base64'"
          @click="outputFormat = 'base64'"
        >
          Base64
        </button>
      </div>
      <span v-if="displayResult" class="text-xs text-muted-foreground">{{ dkLen }} 字节</span>
    </div>

    <!-- 结果面板：复制/清空内嵌标题栏（复制按钮无结果时禁用而非隐藏），内容区固定最小高度，派生前后布局稳定 -->
    <CodePanel label="结果" show-copy show-clear :copy-text="displayResult" class="mb-4" @clear="handleDeriveClear">
      <div class="p-4 min-h-24 flex flex-col justify-center gap-1">
        <template v-if="displayResult">
          <code
            class="font-mono text-[0.8125rem] break-all text-foreground transition-opacity duration-150"
            :class="{ 'opacity-60': deriveStale }"
          >{{ displayResult }}</code>
          <p v-if="deriveStale" class="text-warning text-xs m-0">输入已变化，结果与当前输入不再对应，请重新派生</p>
        </template>
        <p v-else class="text-muted-foreground text-sm m-0 text-center">输入密码与盐后点击「派生密钥」</p>
      </div>
    </CodePanel>

    <!-- 区块二：Django 哈希校验 -->
    <div class="border-t border-border mt-6 pt-6">
      <h2 class="text-base font-semibold text-foreground mb-1">校验 Django 哈希</h2>
      <p class="text-[0.8125rem] text-muted-foreground mb-3">
        粘贴 Django / passlib 的 pbkdf2_sha256$迭代$Base64盐$Base64哈希 格式哈希并输入明文密码即可比对。
      </p>

      <!-- 哈希输入 + 即时解析 -->
      <div class="mb-3">
        <label for="pbkdf2-django-hash" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">Django 哈希</label>
        <input
          id="pbkdf2-django-hash"
          v-model="djangoHash"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          placeholder="粘贴 pbkdf2_sha256$600000$…$… 格式哈希"
          :aria-invalid="!!djangoFormatError"
          :aria-describedby="djangoFormatError ? 'pbkdf2-django-hash-error' : undefined"
        />
        <!-- 解析/格式错误行：固定高度预留，内容切换不引起布局跳动 -->
        <div class="min-h-6 mt-1 flex items-center">
          <p v-if="parsedDjango && !djangoFormatError" class="text-xs text-muted-foreground m-0">
            算法 <code class="font-mono text-foreground">pbkdf2_sha256</code>
            · 迭代 {{ parsedDjango.iterations.toLocaleString('en-US') }}
            · 盐 {{ parsedDjango.saltBytes.length }} 字节
            · 哈希 {{ parsedDjango.hashBytes.length }} 字节
          </p>
          <p v-else-if="djangoFormatError" id="pbkdf2-django-hash-error" class="text-error text-xs m-0">
            {{ djangoFormatError }}
          </p>
        </div>
      </div>

      <!-- 密码输入 -->
      <div class="mb-4">
        <label for="pbkdf2-django-password" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">密码</label>
        <input
          id="pbkdf2-django-password"
          v-model="djangoPassword"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          placeholder="输入待比对的明文密码"
        />
      </div>

      <!-- 校验按钮 + 清空 -->
      <div class="flex items-center justify-between mb-3">
        <button
          type="button"
          class="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-sm text-[0.8125rem] font-sans cursor-pointer active:brightness-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isComputing"
          @click="handleDjangoVerify"
        >
          {{ isComputing && currentOp === 'verify-django' ? '校验中…' : '校验' }}
        </button>
        <ClearButton label="清空校验区" @clear="handleDjangoClear" />
      </div>

      <!-- 校验结果行：固定高度预留，点击校验前后布局稳定 -->
      <div class="min-h-8 flex items-center gap-x-2" aria-live="polite">
        <p v-if="djangoError" class="text-error text-[0.8125rem] m-0 font-medium">{{ djangoError }}</p>
        <p
          v-else-if="djangoResult === 'match'"
          class="text-success text-[0.8125rem] m-0 font-medium transition-opacity duration-150"
          :class="{ 'opacity-60': djangoStale }"
        >
          ✓ 密码匹配
        </p>
        <p
          v-else-if="djangoResult === 'mismatch'"
          class="text-error text-[0.8125rem] m-0 font-medium transition-opacity duration-150"
          :class="{ 'opacity-60': djangoStale }"
        >
          ✗ 密码不匹配
        </p>
        <p v-else class="text-muted-foreground text-[0.8125rem] m-0">待校验</p>
        <span v-if="djangoStale && djangoResult && !djangoError" class="text-warning text-xs">输入已变化，请重新校验</span>
      </div>
    </div>

    <p class="text-xs text-muted-foreground m-0 mt-6">
      纯浏览器端本地运算（Web Crypto 随机盐与派生，Worker 内执行），密码、盐与哈希不会上传到任何服务器。
    </p>
  </div>
</template>
