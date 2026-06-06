<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import DisclosureSection from '../../components/ui/DisclosureSection.vue';
import {
  generateKeyPair,
  exportKeyString,
  importKeyString,
  encryptRSAOAEP,
  decryptRSAOAEP,
  signData,
  verifySignature,
  ALGORITHM_META,
  ALL_ASYMMETRIC_ALGORITHMS,
  isEd25519Supported,
  type AsymmetricAlgorithm,
  type HashAlgorithm,
  type KeyExportFormat,
  type KeyEncoding,
} from '../../utils/crypto/asymmetric';
import type { OutputFormat } from '../../utils/shared/array-buffer';

type OperationMode = 'generate' | 'encrypt' | 'decrypt' | 'sign' | 'verify';

const mode = ref<OperationMode>('generate');
const algorithm = ref<AsymmetricAlgorithm>('RSA-OAEP');
const keySize = ref<number>(2048);
const curve = ref<string>('P-256');
const hash = ref<HashAlgorithm>('SHA-256');
const exportFormat = ref<KeyExportFormat>('spki');
const keyEncoding = ref<KeyEncoding>('pem');
const dataFormat = ref<OutputFormat>('base64');
const publicKeyText = ref('');
const privateKeyText = ref('');
const inputText = ref('');
const outputText = ref('');
const signatureText = ref('');
const errorMsg = ref('');
const isProcessing = ref(false);
const ed25519Supported = ref(true);

/** 当前算法元数据 */
const meta = computed(() => ALGORITHM_META[algorithm.value]);

/** 算法选项 */
const algorithmOptions = computed(() =>
  ALL_ASYMMETRIC_ALGORITHMS.map((id) => ({
    value: id,
    label: ALGORITHM_META[id].label,
  })),
);

/** 密钥长度选项（仅 RSA） */
const keySizeOptions = computed(() =>
  meta.value.keySizeOptions.map((size) => ({ value: size, label: `${size} 位` })),
);

/** 曲线选项（仅 ECDSA） */
const curveOptions = computed(() =>
  meta.value.curveOptions.map((c) => ({ value: c, label: c })),
);

/** 哈希选项 */
const hashOptions = computed(() =>
  meta.value.hashOptions.map((h) => ({ value: h, label: h })),
);

/** 是否显示密钥长度选择 */
const showKeySize = computed(() => meta.value.keySizeOptions.length > 0);

/** 是否显示曲线选择 */
const showCurve = computed(() => meta.value.curveOptions.length > 0);

/** 是否显示哈希选择 */
const showHash = computed(() => meta.value.hashOptions.length > 0);

/** 当前算法支持的操作模式 */
const availableModes = computed(() => {
  const modes: { key: string; label: string }[] = [{ key: 'generate', label: '生成密钥对' }];
  if (meta.value.supportsEncrypt) {
    modes.push({ key: 'encrypt', label: '加密' });
    modes.push({ key: 'decrypt', label: '解密' });
  }
  if (meta.value.supportsSign) {
    modes.push({ key: 'sign', label: '签名' });
    modes.push({ key: 'verify', label: '验签' });
  }
  return modes;
});

/** 导出格式选项（用于生成模式） */
const exportFormatOptions = [
  { value: 'spki', label: 'PEM / DER (SPKI/PKCS#8)' },
  { value: 'jwk', label: 'JWK (JSON)' },
];

/** 编码格式选项（仅非 JWK） */
const keyEncodingOptions = [
  { value: 'pem', label: 'PEM' },
  { value: 'base64', label: 'Base64' },
  { value: 'hex', label: '小写 Hex' },
  { value: 'hexUpper', label: '大写 HEX' },
];

/** 当前模式的输入标签 */
const inputLabel = computed(() => {
  switch (mode.value) {
    case 'encrypt':
      return '明文';
    case 'decrypt':
      return '密文';
    case 'sign':
      return '待签名数据';
    case 'verify':
      return '原始数据';
    default:
      return '';
  }
});

/** 当前模式的输出标签 */
const outputLabel = computed(() => {
  switch (mode.value) {
    case 'encrypt':
      return '密文';
    case 'decrypt':
      return '明文';
    case 'sign':
      return '签名';
    case 'verify':
      return '验签结果';
    default:
      return '';
  }
});

/** 当前模式的占位符 */
const inputPlaceholder = computed(() => {
  switch (mode.value) {
    case 'encrypt':
      return '输入要加密的明文';
    case 'decrypt':
      return `输入 ${dataFormat.value === 'base64' ? 'Base64' : 'Hex'} 编码的密文`;
    case 'sign':
      return '输入要签名的数据';
    case 'verify':
      return '输入原始数据';
    default:
      return '';
  }
});

/** 数据格式标签（根据模式变化） */
const dataFormatLabel = computed(() => {
  return mode.value === 'encrypt' || mode.value === 'sign' ? '输出格式' : '输入格式';
});

/** 数据格式选项 */
const dataFormatOptions = [
  { value: 'base64', label: 'Base64' },
  { value: 'hex', label: '小写 Hex' },
  { value: 'hexUpper', label: '大写 HEX' },
];

/** 操作按钮文本 */
const actionButtonText = computed(() => {
  if (isProcessing.value) return '处理中...';
  switch (mode.value) {
    case 'generate':
      return '生成密钥对';
    case 'encrypt':
      return '加密';
    case 'decrypt':
      return '解密';
    case 'sign':
      return '签名';
    case 'verify':
      return '验签';
  }
});

/** 当前是否禁用操作（Ed25519 不支持时） */
const isDisabled = computed(() => algorithm.value === 'Ed25519' && !ed25519Supported.value);

/** 算法切换时重置参数并校验模式 */
watch(algorithm, () => {
  errorMsg.value = '';
  outputText.value = '';
  keySize.value = meta.value.defaultKeySize;
  curve.value = meta.value.defaultCurve;
  hash.value = meta.value.defaultHash;

  const available = availableModes.value.map((m) => m.key);
  if (!available.includes(mode.value)) {
    mode.value = available[0] as OperationMode;
  }
});

/** 模式切换时清空输出和错误 */
watch(mode, () => {
  errorMsg.value = '';
  outputText.value = '';
});

onMounted(async () => {
  ed25519Supported.value = await isEd25519Supported();
});

/**
 * 获取当前导出/导入使用的格式
 * 生成模式下由 exportFormat 决定，操作模式下固定使用 spki/pkcs8 或 jwk
 */
function getEffectiveExportFormat(): KeyExportFormat {
  return exportFormat.value;
}

/**
 * 生成密钥对并导出
 */
async function handleGenerateKeys() {
  errorMsg.value = '';
  outputText.value = '';
  isProcessing.value = true;

  try {
    const keyPair = await generateKeyPair(algorithm.value, {
      keySize: keySize.value,
      curve: curve.value,
      hash: hash.value,
    });

    const effFormat = getEffectiveExportFormat();
    const pubFormat = effFormat === 'jwk' ? 'jwk' : 'spki';
    const privFormat = effFormat === 'jwk' ? 'jwk' : 'pkcs8';

    publicKeyText.value = await exportKeyString(keyPair.publicKey, pubFormat, keyEncoding.value);
    privateKeyText.value = await exportKeyString(keyPair.privateKey, privFormat, keyEncoding.value);

    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '密钥对生成成功' } }));
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '生成密钥对失败';
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 执行当前操作（加密/解密/签名/验签）
 */
async function execute() {
  errorMsg.value = '';
  outputText.value = '';

  if (!inputText.value) {
    errorMsg.value = `请输入${inputLabel.value}`;
    return;
  }

  isProcessing.value = true;

  try {
    switch (mode.value) {
      case 'encrypt': {
        if (!publicKeyText.value) {
          errorMsg.value = '请输入公钥';
          return;
        }
        const pubFormat = exportFormat.value === 'jwk' ? 'jwk' : 'spki';
        const publicKey = await importKeyString(
          publicKeyText.value,
          algorithm.value,
          pubFormat,
          'public',
          hash.value,
          curve.value,
        );
        outputText.value = await encryptRSAOAEP(inputText.value, publicKey, dataFormat.value);
        break;
      }
      case 'decrypt': {
        if (!privateKeyText.value) {
          errorMsg.value = '请输入私钥';
          return;
        }
        const privFormat = exportFormat.value === 'jwk' ? 'jwk' : 'pkcs8';
        const privateKey = await importKeyString(
          privateKeyText.value,
          algorithm.value,
          privFormat,
          'private',
          hash.value,
          curve.value,
        );
        outputText.value = await decryptRSAOAEP(inputText.value, privateKey, dataFormat.value);
        break;
      }
      case 'sign': {
        if (!privateKeyText.value) {
          errorMsg.value = '请输入私钥';
          return;
        }
        const privFormat = exportFormat.value === 'jwk' ? 'jwk' : 'pkcs8';
        const privateKey = await importKeyString(
          privateKeyText.value,
          algorithm.value,
          privFormat,
          'private',
          hash.value,
          curve.value,
        );
        outputText.value = await signData(inputText.value, privateKey, algorithm.value, hash.value, dataFormat.value);
        break;
      }
      case 'verify': {
        if (!publicKeyText.value) {
          errorMsg.value = '请输入公钥';
          return;
        }
        if (!signatureText.value) {
          errorMsg.value = '请输入签名';
          return;
        }
        const pubFormat = exportFormat.value === 'jwk' ? 'jwk' : 'spki';
        const publicKey = await importKeyString(
          publicKeyText.value,
          algorithm.value,
          pubFormat,
          'public',
          hash.value,
          curve.value,
        );
        const isValid = await verifySignature(
          inputText.value,
          signatureText.value,
          publicKey,
          algorithm.value,
          hash.value,
          dataFormat.value,
        );
        outputText.value = isValid ? '✓ 签名有效' : '✗ 签名无效';
        if (isValid) {
          document.dispatchEvent(new CustomEvent('toast', { detail: { message: '签名验证通过' } }));
        }
        break;
      }
    }
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '操作失败';
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 处理主按钮点击
 */
async function handleAction() {
  if (mode.value === 'generate') {
    await handleGenerateKeys();
  } else {
    await execute();
  }
}

/**
 * 清空所有输入和输出
 */
function handleClear() {
  publicKeyText.value = '';
  privateKeyText.value = '';
  inputText.value = '';
  outputText.value = '';
  signatureText.value = '';
  errorMsg.value = '';
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="非对称加解密"
      description="支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 等算法的密钥生成、加解密与签名验签"
      :show-example="false"
    />

    <!-- Ed25519 不支持提示 -->
    <div
      v-if="algorithm === 'Ed25519' && !ed25519Supported"
      class="mb-4 p-3 border border-error rounded-sm bg-red-50 text-error text-[0.8125rem]"
    >
      当前浏览器不支持 Ed25519 算法，请使用 Chrome 132+、Edge 132+ 或 Firefox 129+
    </div>

    <!-- 操作模式切换 -->
    <ModeTabGroup v-model="mode" :options="availableModes" />

    <!-- 算法和参数选择 -->
    <div class="flex gap-4 mb-4 flex-wrap">
      <SelectListbox v-model="algorithm" label="算法" class="w-[180px]" :options="algorithmOptions" />
      <SelectListbox
        v-if="showKeySize"
        v-model="keySize"
        label="密钥长度"
        class="w-[140px]"
        :options="keySizeOptions"
      />
      <SelectListbox
        v-if="showCurve"
        v-model="curve"
        label="椭圆曲线"
        class="w-[140px]"
        :options="curveOptions"
      />
      <SelectListbox
        v-if="showHash"
        v-model="hash"
        label="哈希算法"
        class="w-[160px]"
        :options="hashOptions"
      />
    </div>

    <!-- 生成模式：导出格式选择 -->
    <div v-if="mode === 'generate'" class="flex gap-4 mb-4 flex-wrap">
      <SelectListbox
        v-model="exportFormat"
        label="导出格式"
        class="w-[220px]"
        :options="exportFormatOptions"
      />
      <SelectListbox
        v-if="exportFormat !== 'jwk'"
        v-model="keyEncoding"
        label="编码格式"
        class="w-[140px]"
        :options="keyEncodingOptions"
      />
    </div>

    <!-- 密钥输入区域 -->
    <div class="mb-4">
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1">
          <label class="block text-[0.8125rem] text-muted font-medium">公钥</label>
          <CopyButton v-if="publicKeyText" :text="publicKeyText" label="复制公钥" />
        </div>
        <textarea
          v-model="publicKeyText"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="5"
          placeholder="公钥将显示在这里，或粘贴已有公钥"
        ></textarea>
      </div>
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1">
          <label class="block text-[0.8125rem] text-muted font-medium">私钥</label>
          <CopyButton v-if="privateKeyText" :text="privateKeyText" label="复制私钥" />
        </div>
        <textarea
          v-model="privateKeyText"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="5"
          placeholder="私钥将显示在这里，或粘贴已有私钥"
        ></textarea>
      </div>
    </div>

    <!-- 操作按钮行 -->
    <div class="flex gap-2 items-center mb-4">
      <button
        class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isProcessing || isDisabled"
        @click="handleAction"
      >
        {{ actionButtonText }}
      </button>
      <ClearButton @clear="handleClear" />
    </div>

    <!-- 数据格式选择器（操作模式） -->
    <div v-if="mode !== 'generate'" class="mb-4">
      <SelectListbox
        v-model="dataFormat"
        :label="dataFormatLabel"
        :options="dataFormatOptions"
      />
    </div>

    <!-- 操作模式输入区域（仅非生成模式显示） -->
    <div v-if="mode !== 'generate'" class="mb-4">
      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">{{ inputLabel }}</label>
        <textarea
          v-model="inputText"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="4"
          :placeholder="inputPlaceholder"
        ></textarea>
      </div>

      <!-- 验签模式额外需要签名输入 -->
      <div v-if="mode === 'verify'" class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">签名</label>
        <textarea
          v-model="signatureText"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="3"
          :placeholder="`输入 ${dataFormat === 'base64' ? 'Base64' : 'Hex'} 编码的签名`"
        ></textarea>
      </div>
    </div>

    <!-- 错误信息 -->
    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <!-- 输出区域 -->
    <div v-if="outputText && mode !== 'generate'" class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ outputLabel }}</span>
        <CopyButton :text="outputText" label="复制结果" />
      </div>
      <div
        class="border border-border rounded-md p-4 bg-card"
        :class="outputText.startsWith('✓') ? 'border-success' : outputText.startsWith('✗') ? 'border-error' : ''"
      >
        <code
          class="font-mono text-[0.8125rem] break-all"
          :class="outputText.startsWith('✓') ? 'text-success' : outputText.startsWith('✗') ? 'text-error' : 'text-text'"
        >
          {{ outputText }}
        </code>
      </div>
    </div>

    <!-- 算法说明 -->
    <DisclosureSection title="算法说明">
      <div class="text-[0.8125rem] text-muted leading-relaxed space-y-2">
        <p class="m-0">
          <strong>RSA-OAEP</strong>：基于 RSA 的加密算法，使用公钥加密、私钥解密。支持 2048/3072/4096 位密钥长度和 SHA-256/384/512 哈希。
        </p>
        <p class="m-0">
          <strong>RSA-PSS</strong>：基于 RSA 的签名算法，使用私钥签名、公钥验签。salt 长度根据哈希算法自动确定。
        </p>
        <p class="m-0">
          <strong>ECDSA</strong>：椭圆曲线数字签名算法，支持 P-256/P-384/P-521 曲线。密钥更短，性能更好。
        </p>
        <p class="m-0">
          <strong>Ed25519</strong>：现代 Edwards 曲线签名算法，安全性高、速度快。需要 Chrome/Edge 132+ 或 Firefox 129+。
        </p>
        <p class="m-0">
          密钥导出格式：<strong>PEM</strong> 为标准文本格式（带 BEGIN/END 标记）；<strong>JWK</strong> 为 JSON Web Key 格式；<strong>Base64/Hex</strong> 为纯二进制编码。
        </p>
      </div>
    </DisclosureSection>
  </div>
</template>
