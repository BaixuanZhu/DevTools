<script setup lang="ts">
/**
 * Argon2 密码哈希工具页主组件（本工具私有）。
 *
 * 两段式布局（同 BcryptTool）：生成区 + border-t 分隔的校验区。
 * Argon2 是内存困难型慢哈希，交互为按钮触发而非键入即算（DESIGN.md 慢操作
 * 例外）：生成/校验请求经 reqId 递增编号，回包 reqId 与当前序号不一致即丢弃，
 * 防止连点与改输入后的乱序竞态；输入变化后既有结果弱化并提示"输入已变化"
 * （计算期间改输入的时序由回包时的输入快照比对兜底）。
 * 慢计算全部在 Web Worker 中执行（hash-wasm 被切进 worker chunk，主包无感）。
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  ARGON2_TYPES,
  generateArgon2Salt,
  parseArgon2Hash,
  getArgon2HashFormatError,
  validateArgon2Params,
  type Argon2Type,
  type Argon2HashRequest,
  type Argon2VerifyRequest,
  type Argon2WorkerResponse,
} from '../../utils/crypto/argon2';

// ---- 生成区状态 ----

/** 待哈希密码（默认示例，打开即可体验；明文显示便于比对） */
const password = ref('DevTools@2026');
/** Argon2 类型（argon2id 为新项目默认推荐） */
const type = ref<Argon2Type>('argon2id');
/** 内存参数（MiB，UI 友好单位；下发 Worker 前 ×1024 转 KiB） */
const memMiB = ref(64);
/** 迭代次数 t */
const iterations = ref(3);
/** 并行度 p */
const parallelism = ref(4);
/** 生成的 PHC 哈希结果 */
const hashResult = ref('');
/** 结果是否已因输入变化而过期 */
const hashStale = ref(false);
/** 生成区错误（中文） */
const generateError = ref('');

// ---- 校验区状态 ----

/**
 * 待校验 PHC 哈希。默认值为实现期用 hash-wasm 以低参数档
 * （m=1024,t=1,p=1,argon2id，盐 "devtools-salt-16"）实算固化的向量，
 * 密码 DevTools@2026 与之匹配，保证首屏校验秒回。
 */
const verifyHash = ref(
  '$argon2id$v=19$m=1024,t=1,p=1$ZGV2dG9vbHMtc2FsdC0xNg$jIIX1uovxCL2ZHQBN7UUqThrqDCyZEeBV5W7pN/wweE',
);
/** 待比对明文密码 */
const verifyPassword = ref('DevTools@2026');
/** 校验结果：match / mismatch / null（未校验） */
const verifyResult = ref<'match' | 'mismatch' | null>(null);
/** 校验结果是否已因输入变化而过期 */
const verifyStale = ref(false);
/** 校验区错误（点击触发/Worker 返回的中文错误；格式错误另行即时展示） */
const verifyError = ref('');

// ---- Worker 与请求序号 ----

/** 懒初始化的慢计算 Worker（首个按钮点击时创建） */
let worker: Worker | null = null;
/** 递增请求序号：每次发请求 +1，回包不一致即视为过期丢弃 */
let reqSeq = 0;
/** 是否有计算进行中（生成/校验共用，进行中两按钮均禁用防连点） */
const isComputing = ref(false);
/** 当前进行中的操作类别（用于按钮文案与错误归位） */
const currentOp = ref<'hash' | 'verify' | null>(null);
/** 进行中哈希请求的输入快照（回包时与当前输入比对：计算期间改过输入则结果直接标记过期） */
let pendingHashInput: { password: string; type: Argon2Type; mKiB: number; t: number; p: number } | null = null;
/** 进行中校验请求的输入快照（作用同上） */
let pendingVerifyInput: { hash: string; password: string } | null = null;

/** 类型选项（argon2id 标注推荐） */
const typeOptions = ARGON2_TYPES.map((t) => ({
  value: t,
  label: t === 'argon2id' ? 'argon2id（推荐）' : t,
}));

/** 当前参数组合的中文错误（含 m ≥ 8×p 约束，纯计算即时显示） */
const paramError = computed(() => validateArgon2Params(memMiB.value * 1024, iterations.value, parallelism.value));

/** 校验区哈希的即时解析结果（粘贴即显示类型/版本/参数/盐长度，纯计算） */
const parsedHash = computed(() => parseArgon2Hash(verifyHash.value));

/** 校验区哈希的格式错误文案（空串表示合法或未输入，即时展示） */
const verifyFormatError = computed(() => getArgon2HashFormatError(verifyHash.value));

/**
 * 确保 Worker 已就绪：首个请求前懒创建并挂载消息/错误处理器。
 * @returns Worker 实例（创建失败返回 null）
 */
function ensureWorker(): Worker | null {
  if (worker) return worker;
  worker = new Worker(new URL('../../utils/crypto/argon2.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (e: MessageEvent<Argon2WorkerResponse>) => {
    const resp = e.data;
    if (resp.reqId !== reqSeq) return; // 过期响应丢弃
    isComputing.value = false;
    currentOp.value = null;
    if (!resp.ok) {
      if (resp.kind === 'hash') generateError.value = resp.error;
      else verifyError.value = resp.error;
      return;
    }
    if (resp.kind === 'hash') {
      hashResult.value = resp.hash;
      // 计算期间输入可能已变（watch 无法覆盖"回包晚于改输入"的时序），回包时以快照兜底判定过期
      const snap = pendingHashInput;
      pendingHashInput = null;
      hashStale.value =
        snap !== null &&
        (snap.password !== password.value ||
          snap.type !== type.value ||
          snap.mKiB !== memMiB.value * 1024 ||
          snap.t !== iterations.value ||
          snap.p !== parallelism.value);
    } else {
      verifyResult.value = resp.match ? 'match' : 'mismatch';
      const snap = pendingVerifyInput;
      pendingVerifyInput = null;
      verifyStale.value =
        snap !== null && (snap.hash !== verifyHash.value.trim() || snap.password !== verifyPassword.value);
    }
  };
  worker.onerror = () => {
    const msg = 'Worker 执行出错，请刷新页面重试';
    if (currentOp.value === 'verify') verifyError.value = msg;
    else generateError.value = msg;
    isComputing.value = false;
    currentOp.value = null;
  };
  return worker;
}

/** 点击「生成哈希」：校验参数后自产随机盐并下发 Worker 计算。 */
function handleGenerate(): void {
  generateError.value = '';
  if (!password.value) {
    generateError.value = '请输入密码';
    return;
  }
  if (paramError.value) {
    generateError.value = paramError.value;
    return;
  }
  const w = ensureWorker();
  if (!w) return;
  const mKiB = memMiB.value * 1024;
  reqSeq += 1;
  pendingHashInput = { password: password.value, type: type.value, mKiB, t: iterations.value, p: parallelism.value };
  isComputing.value = true;
  currentOp.value = 'hash';
  const req: Argon2HashRequest = {
    kind: 'hash',
    reqId: reqSeq,
    password: password.value,
    salt: generateArgon2Salt(),
    type: type.value,
    mKiB,
    t: iterations.value,
    p: parallelism.value,
  };
  w.postMessage(req);
}

/** 点击「校验」：先做中文格式校验，合法才下发 Worker 比对。 */
function handleVerify(): void {
  verifyError.value = '';
  verifyResult.value = null;
  verifyStale.value = false;
  if (!verifyHash.value.trim()) {
    verifyError.value = '请输入要校验的 Argon2 哈希';
    return;
  }
  const formatError = getArgon2HashFormatError(verifyHash.value);
  if (formatError) {
    verifyError.value = formatError;
    return;
  }
  if (!verifyPassword.value) {
    verifyError.value = '请输入密码';
    return;
  }
  const w = ensureWorker();
  if (!w) return;
  const hashToSend = verifyHash.value.trim();
  reqSeq += 1;
  pendingVerifyInput = { hash: hashToSend, password: verifyPassword.value };
  isComputing.value = true;
  currentOp.value = 'verify';
  const req: Argon2VerifyRequest = {
    kind: 'verify',
    reqId: reqSeq,
    password: verifyPassword.value,
    hash: hashToSend,
  };
  w.postMessage(req);
}

/** 清空生成区（密码与结果一并清除；递增 reqId 使在途响应失效，不再回填） */
function handleGenerateClear(): void {
  reqSeq += 1;
  pendingHashInput = null;
  isComputing.value = false;
  currentOp.value = null;
  password.value = '';
  hashResult.value = '';
  hashStale.value = false;
  generateError.value = '';
}

/** 清空校验区（哈希与密码一并清除；作用同上） */
function handleVerifyClear(): void {
  reqSeq += 1;
  pendingVerifyInput = null;
  isComputing.value = false;
  currentOp.value = null;
  verifyHash.value = '';
  verifyPassword.value = '';
  verifyResult.value = null;
  verifyStale.value = false;
  verifyError.value = '';
}

// 慢哈希不做键入即算：输入变化只清除旧错误并标记既有结果过期（弱化展示）
watch([password, type, memMiB, iterations, parallelism], () => {
  generateError.value = '';
  if (hashResult.value) hashStale.value = true;
});
watch([verifyHash, verifyPassword], () => {
  verifyError.value = '';
  if (verifyResult.value !== null) verifyStale.value = true;
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
      title="Argon2 密码哈希"
      description="生成带随机盐的 argon2id/i/d 密码哈希，在线校验 PHC 哈希并解析类型、版本与参数"
      :show-example="false"
    />

    <!-- 区块一：生成哈希 -->
    <h2 class="text-base font-semibold text-foreground mb-1">生成哈希</h2>
    <p class="text-[0.8125rem] text-muted-foreground mb-3">
      每次生成使用新的 16 字节随机盐并输出标准 PHC 格式（$argon2id$v=19$m=…,t=…,p=…$盐$哈希），盐内嵌在哈希中，无需单独保存。
    </p>

    <!-- 密码输入 -->
    <div class="mb-3">
      <label for="argon2-password" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">密码</label>
      <input
        id="argon2-password"
        v-model="password"
        type="text"
        autocomplete="off"
        spellcheck="false"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
        placeholder="输入要哈希的密码"
      />
    </div>

    <!-- 参数面板：类型 + 内存/迭代/并行度 -->
    <div class="mb-3">
      <SelectListbox v-model="type" label="类型" :options="typeOptions" />
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-1">
      <div>
        <label for="argon2-memory" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">内存 m（MiB）</label>
        <input
          id="argon2-memory"
          v-model.number="memMiB"
          type="number"
          min="1"
          max="256"
          step="1"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          :aria-invalid="!!paramError"
          aria-describedby="argon2-param-hint"
        />
      </div>
      <div>
        <label for="argon2-iterations" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">迭代 t</label>
        <input
          id="argon2-iterations"
          v-model.number="iterations"
          type="number"
          min="1"
          max="10"
          step="1"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          :aria-invalid="!!paramError"
          aria-describedby="argon2-param-hint"
        />
      </div>
      <div>
        <label for="argon2-parallelism" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">并行度 p</label>
        <input
          id="argon2-parallelism"
          v-model.number="parallelism"
          type="number"
          min="1"
          max="8"
          step="1"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          :aria-invalid="!!paramError"
          aria-describedby="argon2-param-hint"
        />
      </div>
    </div>
    <!-- 参数提示行：固定高度预留，合法提示与参数错误切换不引起布局跳动 -->
    <div class="min-h-6 flex items-center mb-4" id="argon2-param-hint" aria-live="polite">
      <p v-if="paramError" class="text-error text-xs m-0">{{ paramError }}</p>
      <p v-else class="text-xs text-muted-foreground m-0">
        内存与迭代越大越安全也越慢：默认档（64 MiB × 3 次）约 0.1-0.5 秒，256 MiB 档可能需数秒；m ∈ 1-256 MiB、t ∈ 1-10、p ∈ 1-8。
      </p>
    </div>

    <!-- 生成按钮 + 错误（错误与按钮同行展示，出现/消失不引起下方跳动） -->
    <div class="flex items-center gap-3 mb-3 flex-wrap">
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-sm text-[0.8125rem] font-sans cursor-pointer active:brightness-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isComputing"
        @click="handleGenerate"
      >
        {{ isComputing && currentOp === 'hash' ? '计算中…' : '生成哈希' }}
      </button>
      <p v-if="generateError" class="text-error text-[0.8125rem] m-0">{{ generateError }}</p>
    </div>

    <!-- 结果面板：复制/清空内嵌标题栏（复制按钮无结果时禁用而非隐藏），内容区固定最小高度，生成前后布局稳定 -->
    <CodePanel label="结果" show-copy show-clear :copy-text="hashResult" class="mb-4" @clear="handleGenerateClear">
      <div class="p-4 min-h-24 flex flex-col justify-center gap-1">
        <template v-if="hashResult">
          <code
            class="font-mono text-[0.8125rem] break-all text-foreground transition-opacity duration-150"
            :class="{ 'opacity-60': hashStale }"
          >{{ hashResult }}</code>
          <p v-if="hashStale" class="text-warning text-xs m-0">输入已变化，结果与当前输入不再对应，请重新生成</p>
        </template>
        <p v-else class="text-muted-foreground text-sm m-0 text-center">输入密码后点击「生成哈希」</p>
      </div>
    </CodePanel>

    <!-- 区块二：校验哈希 -->
    <div class="border-t border-border mt-6 pt-6">
      <h2 class="text-base font-semibold text-foreground mb-1">校验哈希</h2>
      <p class="text-[0.8125rem] text-muted-foreground mb-3">
        粘贴既有 PHC 格式哈希并输入明文密码即可比对，支持 argon2id / argon2i / argon2d（v=19）。
      </p>

      <!-- 哈希输入 + 即时解析 -->
      <div class="mb-3">
        <label for="argon2-verify-hash" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">Argon2 哈希</label>
        <input
          id="argon2-verify-hash"
          v-model="verifyHash"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          placeholder="粘贴以 $argon2id$ / $argon2i$ / $argon2d$ 开头的 PHC 哈希"
          :aria-invalid="!!verifyFormatError"
          :aria-describedby="verifyFormatError ? 'argon2-verify-hash-error' : undefined"
        />
        <!-- 解析/格式错误行：固定高度预留，内容切换不引起布局跳动 -->
        <div class="min-h-6 mt-1 flex items-center">
          <p v-if="parsedHash && !verifyFormatError" class="text-xs text-muted-foreground m-0">
            类型 <code class="font-mono text-foreground">{{ parsedHash.type }}</code>
            · v{{ parsedHash.version }}
            · m={{ parsedHash.m }} KiB
            · t={{ parsedHash.t }}
            · p={{ parsedHash.p }}
            · 盐 {{ parsedHash.saltLength }} 字节 / 哈希 {{ parsedHash.hashLength }} 字节
          </p>
          <p v-else-if="verifyFormatError" id="argon2-verify-hash-error" class="text-error text-xs m-0">
            {{ verifyFormatError }}
          </p>
        </div>
      </div>

      <!-- 密码输入 -->
      <div class="mb-4">
        <label for="argon2-verify-password" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">密码</label>
        <input
          id="argon2-verify-password"
          v-model="verifyPassword"
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
          @click="handleVerify"
        >
          {{ isComputing && currentOp === 'verify' ? '校验中…' : '校验' }}
        </button>
        <ClearButton label="清空校验区" @clear="handleVerifyClear" />
      </div>

      <!-- 校验结果行：固定高度预留，点击校验前后布局稳定 -->
      <div class="min-h-8 flex items-center gap-x-2" aria-live="polite">
        <p v-if="verifyError" class="text-error text-[0.8125rem] m-0 font-medium">{{ verifyError }}</p>
        <p
          v-else-if="verifyResult === 'match'"
          class="text-success text-[0.8125rem] m-0 font-medium transition-opacity duration-150"
          :class="{ 'opacity-60': verifyStale }"
        >
          ✓ 密码匹配
        </p>
        <p
          v-else-if="verifyResult === 'mismatch'"
          class="text-error text-[0.8125rem] m-0 font-medium transition-opacity duration-150"
          :class="{ 'opacity-60': verifyStale }"
        >
          ✗ 密码不匹配
        </p>
        <p v-else class="text-muted-foreground text-[0.8125rem] m-0">待校验</p>
        <span v-if="verifyStale && verifyResult && !verifyError" class="text-warning text-xs">输入已变化，请重新校验</span>
      </div>
    </div>

    <p class="text-xs text-muted-foreground m-0 mt-6">
      纯浏览器端本地运算（Web Crypto 生成随机盐 + Web Worker 内 WASM 计算），密码与哈希不会上传到任何服务器。
    </p>
  </div>
</template>
