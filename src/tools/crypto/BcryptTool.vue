<script setup lang="ts">
/**
 * BCrypt 密码哈希工具页主组件（本工具私有）。
 *
 * 两段式布局（参照 HashGenerator）：生成区 + border-t 分隔的校验区。
 * bcrypt 是慢哈希，交互为按钮触发而非键入即算（DESIGN.md 慢操作例外）：
 * 生成/校验请求经 reqId 递增编号，回包 reqId 与当前序号不一致即丢弃，
 * 防止连点与改输入后的乱序竞态；输入变化后既有结果弱化并提示"输入已变化"
 * （计算期间改输入的时序由回包时的输入快照比对兜底）。
 * 慢计算全部在 Web Worker 中执行（bcryptjs 被切进 worker chunk，主包无感）。
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  COST_MIN,
  COST_MAX,
  COST_DEFAULT,
  generateSalt,
  parseBcryptHash,
  getBcryptHashFormatError,
  normalizeHashForCompare,
  getPasswordByteInfo,
  type WorkerHashRequest,
  type WorkerCompareRequest,
  type WorkerResponse,
} from '../../utils/crypto/bcrypt';

// ---- 生成区状态 ----

/** 待哈希密码（默认示例，打开即可体验；明文显示便于比对） */
const password = ref('DevTools@2026');
/** cost 因子（4-15，默认 10） */
const cost = ref<number>(COST_DEFAULT);
/** 生成的哈希结果 */
const hashResult = ref('');
/** 结果是否已因输入变化而过期 */
const hashStale = ref(false);
/** 生成区错误（中文） */
const generateError = ref('');

// ---- 校验区状态 ----

/** 待校验哈希（默认示例为 jBCrypt 官方向量，'abc' 与之匹配） */
const verifyHash = ref('$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i');
/** 待比对明文密码 */
const verifyPassword = ref('abc');
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
const currentOp = ref<'hash' | 'compare' | null>(null);
/** 进行中哈希请求的输入快照（回包时与当前输入比对：计算期间改过输入则结果直接标记过期） */
let pendingHashInput: { password: string; cost: number } | null = null;
/** 进行中校验请求的输入快照（作用同上） */
let pendingCompareInput: { hash: string; password: string } | null = null;

/** cost 档位选项（4-15，极端档位附量级提示） */
const costOptions = Array.from({ length: COST_MAX - COST_MIN + 1 }, (_, i) => {
  const value = COST_MIN + i;
  let label = String(value);
  if (value === COST_MIN) label = `${value}（最快）`;
  else if (value === COST_DEFAULT) label = `${value}（推荐）`;
  else if (value === COST_MAX) label = `${value}（很慢）`;
  return { value, label };
});

/** 当前密码的 UTF-8 字节信息（72 字节截断检测，纯计算） */
const passwordInfo = computed(() => getPasswordByteInfo(password.value));

/** 校验区哈希的即时解析结果（粘贴即显示版本/cost/盐，纯计算） */
const parsedHash = computed(() => parseBcryptHash(verifyHash.value));

/** 校验区哈希的格式错误文案（空串表示合法或未输入，即时展示） */
const verifyFormatError = computed(() => getBcryptHashFormatError(verifyHash.value));

/**
 * 确保 Worker 已就绪：首个请求前懒创建并挂载消息/错误处理器。
 * @returns Worker 实例（创建失败返回 null）
 */
function ensureWorker(): Worker | null {
  if (worker) return worker;
  worker = new Worker(new URL('../../utils/crypto/bcrypt.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
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
      hashStale.value = snap !== null && (snap.password !== password.value || snap.cost !== cost.value);
    } else {
      verifyResult.value = resp.match ? 'match' : 'mismatch';
      const snap = pendingCompareInput;
      pendingCompareInput = null;
      verifyStale.value =
        snap !== null &&
        (snap.hash !== normalizeHashForCompare(verifyHash.value.trim()) || snap.password !== verifyPassword.value);
    }
  };
  worker.onerror = () => {
    const msg = 'Worker 执行出错，请刷新页面重试';
    if (currentOp.value === 'compare') verifyError.value = msg;
    else generateError.value = msg;
    isComputing.value = false;
    currentOp.value = null;
  };
  return worker;
}

/** 点击「生成哈希」：主线程自产随机盐后下发 Worker 计算。 */
function handleGenerate(): void {
  generateError.value = '';
  if (!password.value) {
    generateError.value = '请输入密码';
    return;
  }
  const w = ensureWorker();
  if (!w) return;
  const salt = generateSalt(cost.value);
  reqSeq += 1;
  pendingHashInput = { password: password.value, cost: cost.value };
  isComputing.value = true;
  currentOp.value = 'hash';
  const req: WorkerHashRequest = {
    kind: 'hash',
    reqId: reqSeq,
    password: password.value,
    salt,
  };
  w.postMessage(req);
}

/** 点击「校验」：先做中文格式校验，合法才下发 Worker 比对。 */
function handleVerify(): void {
  verifyError.value = '';
  verifyResult.value = null;
  verifyStale.value = false;
  if (!verifyHash.value.trim()) {
    verifyError.value = '请输入要校验的 bcrypt 哈希';
    return;
  }
  const formatError = getBcryptHashFormatError(verifyHash.value);
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
  // bcryptjs 不识别 $2x 前缀（算法上与 $2a 等价），比对前归一化，保证"全前缀兼容"口径
  const hashToSend = normalizeHashForCompare(verifyHash.value.trim());
  reqSeq += 1;
  pendingCompareInput = { hash: hashToSend, password: verifyPassword.value };
  isComputing.value = true;
  currentOp.value = 'compare';
  const req: WorkerCompareRequest = {
    kind: 'compare',
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
  pendingCompareInput = null;
  isComputing.value = false;
  currentOp.value = null;
  verifyHash.value = '';
  verifyPassword.value = '';
  verifyResult.value = null;
  verifyStale.value = false;
  verifyError.value = '';
}

// 慢哈希不做键入即算：输入变化只清除旧错误并标记既有结果过期（弱化展示）
watch([password, cost], () => {
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
      title="BCrypt 密码哈希"
      description="生成带随机盐的 bcrypt 密码哈希，在线校验密码匹配并解析版本、cost 与盐"
      :show-example="false"
    />

    <!-- 区块一：生成哈希 -->
    <h2 class="text-base font-semibold text-foreground mb-1">生成哈希</h2>
    <p class="text-[0.8125rem] text-muted-foreground mb-3">
      每次生成使用新的随机盐，同一密码每次结果不同属正常现象；盐内嵌在哈希中，无需单独保存。
    </p>

    <!-- 密码输入 + 72 字节警告 -->
    <div class="mb-3">
      <label for="bcrypt-password" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">密码</label>
      <input
        id="bcrypt-password"
        v-model="password"
        type="text"
        autocomplete="off"
        spellcheck="false"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
        placeholder="输入要哈希的密码"
      />
      <p v-if="passwordInfo.truncated" class="text-warning text-[0.8125rem] m-0 mt-1">
        当前密码 {{ passwordInfo.bytes }} 字节，超过 bcrypt 的 72 字节上限，超出部分会被静默截断（中文每字占 3 字节）
      </p>
    </div>

    <!-- cost 选择 + 量级说明 -->
    <div class="mb-4">
      <SelectListbox v-model="cost" label="cost 因子" :options="costOptions" />
      <p class="text-xs text-muted-foreground m-0 mt-1">
        cost 每加 1 计算耗时约翻倍：10 为业界常用默认，12 以上等待明显，15 约需数十秒。
      </p>
    </div>

    <!-- 生成按钮 + 错误 -->
    <div class="flex items-center gap-3 mb-3">
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-sm text-[0.8125rem] font-sans cursor-pointer active:brightness-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isComputing"
        @click="handleGenerate"
      >
        {{ isComputing && currentOp === 'hash' ? '计算中…' : '生成哈希' }}
      </button>
    </div>
    <p v-if="generateError" class="text-error text-[0.8125rem] m-0 mb-3">{{ generateError }}</p>

    <!-- 生成结果卡片 -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">生成的哈希</span>
        <div class="flex gap-2">
          <CopyButton v-if="hashResult" :text="hashResult" />
          <ClearButton label="清空生成区" @clear="handleGenerateClear" />
        </div>
      </div>
      <div
        v-if="hashResult"
        class="border border-border rounded-md bg-card px-4 py-2.5 transition-opacity duration-150"
        :class="{ 'opacity-60': hashStale }"
      >
        <code class="font-mono text-[0.8125rem] break-all text-foreground">{{ hashResult }}</code>
        <p v-if="hashStale" class="text-warning text-xs m-0 mt-1">输入已变化，该哈希与当前输入不再对应，请重新生成。</p>
      </div>
      <div
        v-else
        class="border border-border rounded-md p-4 bg-card text-center text-muted-foreground text-sm"
      >
        输入密码后点击「生成哈希」
      </div>
    </div>

    <!-- 区块二：校验哈希 -->
    <div class="border-t border-border mt-6 pt-6">
      <h2 class="text-base font-semibold text-foreground mb-1">校验哈希</h2>
      <p class="text-[0.8125rem] text-muted-foreground mb-3">
        粘贴既有 bcrypt 哈希并输入明文密码即可比对，支持 $2a$/$2b$/$2y$/$2x$ 前缀。
      </p>

      <!-- 哈希输入 + 即时解析 -->
      <div class="mb-3">
        <label for="bcrypt-verify-hash" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">bcrypt 哈希</label>
        <input
          id="bcrypt-verify-hash"
          v-model="verifyHash"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-foreground bg-card box-border focus:outline-none focus:border-primary"
          placeholder="粘贴以 $2a$ / $2b$ / $2y$ 开头的 60 字符哈希"
          :aria-invalid="!!verifyFormatError"
          :aria-describedby="verifyFormatError ? 'bcrypt-verify-hash-error' : undefined"
        />
        <p v-if="parsedHash" class="text-xs text-muted-foreground m-0 mt-1">
          版本 <code class="font-mono text-foreground">{{ parsedHash.prefix }}</code>
          · cost {{ parsedHash.cost }}
          · 盐 <code class="font-mono text-foreground">{{ parsedHash.salt }}</code>
        </p>
        <p v-else-if="verifyFormatError" id="bcrypt-verify-hash-error" class="text-error text-[0.8125rem] m-0 mt-1">
          {{ verifyFormatError }}
        </p>
      </div>

      <!-- 密码输入 -->
      <div class="mb-4">
        <label for="bcrypt-verify-password" class="block text-[0.8125rem] text-muted-foreground font-medium mb-1">密码</label>
        <input
          id="bcrypt-verify-password"
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
          {{ isComputing && currentOp === 'compare' ? '校验中…' : '校验' }}
        </button>
        <ClearButton label="清空校验区" @clear="handleVerifyClear" />
      </div>

      <!-- 校验结果三态 -->
      <p v-if="verifyError" class="text-error text-[0.8125rem] m-0">{{ verifyError }}</p>
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
      <p v-if="verifyStale && verifyResult" class="text-warning text-xs m-0 mt-1">输入已变化，校验结果可能不再对应，请重新校验。</p>
    </div>

    <p class="text-xs text-muted-foreground m-0 mt-6">
      纯浏览器端本地运算（Web Crypto 生成随机盐 + Web Worker 计算），密码与哈希不会上传到任何服务器。
    </p>
  </div>
</template>
