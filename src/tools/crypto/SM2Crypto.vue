<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';

import {
  generateSM2KeyPair,
  encryptSM2,
  decryptSM2,
  isValidSM2PublicKey,
  isValidSM2PrivateKey,
  SM2_CIPHER_MODES,
  SM2_OUTPUT_FORMATS,
  type SM2CipherMode,
} from '../../utils/crypto/sm2';
import type { OutputFormat } from '../../utils/shared/array-buffer';

/** 操作模式 */
type OperationMode = 'generate' | 'encrypt' | 'decrypt';

const mode = ref<OperationMode>('generate');
const cipherMode = ref<SM2CipherMode>('C1C3C2');
const dataFormat = ref<OutputFormat>('hex');
const publicKeyText = ref('');
const privateKeyText = ref('');
const inputText = ref('');
const outputText = ref('');
const errorMsg = ref('');
const isProcessing = ref(false);

/** 密文模式选项 */
const cipherModeOptions = computed(() =>
  SM2_CIPHER_MODES.map((m) => ({ value: m, label: m })),
);

/** 数据格式选项 */
const dataFormatOptions = computed(() =>
  SM2_OUTPUT_FORMATS.map((f) => ({ value: f.value, label: f.label })),
);

/** 操作模式选项 */
const modeOptions = computed(() => {
  const modes: { key: string; label: string }[] = [
    { key: 'generate', label: '生成密钥对' },
    { key: 'encrypt', label: '加密' },
    { key: 'decrypt', label: '解密' },
  ];
  return modes;
});

/** 当前模式的输入标签 */
const inputLabel = computed(() => {
  switch (mode.value) {
    case 'encrypt':
      return '明文';
    case 'decrypt':
      return '密文';
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
    default:
      return '';
  }
});

/** 输入占位符 */
const inputPlaceholder = computed(() => {
  switch (mode.value) {
    case 'encrypt':
      return '输入要加密的明文';
    case 'decrypt':
      return `输入 ${dataFormat.value === 'base64' ? 'Base64' : 'Hex'} 编码的密文`;
    default:
      return '';
  }
});

/** 数据格式标签（根据模式变化） */
const dataFormatLabel = computed(() =>
  mode.value === 'encrypt' ? '输出格式' : '输入格式',
);

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
  }
});

/** 模式切换时清空输出和错误 */
watch(mode, () => {
  errorMsg.value = '';
  outputText.value = '';
});

/**
 * 生成 SM2 密钥对并显示
 */
function handleGenerateKeys() {
  errorMsg.value = '';
  outputText.value = '';
  isProcessing.value = true;

  try {
    const keyPair = generateSM2KeyPair();
    publicKeyText.value = keyPair.publicKey;
    privateKeyText.value = keyPair.privateKey;
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '密钥对生成成功' } }));
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '生成密钥对失败';
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 执行加密或解密操作
 */
function execute() {
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
        if (!isValidSM2PublicKey(publicKeyText.value)) {
          errorMsg.value = '公钥格式无效，应为 130 字符十六进制（以 04 开头）';
          return;
        }
        outputText.value = encryptSM2(
          inputText.value,
          publicKeyText.value.trim(),
          cipherMode.value,
          dataFormat.value,
        );
        break;
      }
      case 'decrypt': {
        if (!privateKeyText.value) {
          errorMsg.value = '请输入私钥';
          return;
        }
        if (!isValidSM2PrivateKey(privateKeyText.value)) {
          errorMsg.value = '私钥格式无效，应为 64 字符十六进制';
          return;
        }
        outputText.value = decryptSM2(
          inputText.value,
          privateKeyText.value.trim(),
          cipherMode.value,
          dataFormat.value,
        );
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
function handleAction() {
  if (mode.value === 'generate') {
    handleGenerateKeys();
  } else {
    execute();
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
  errorMsg.value = '';
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="SM2 国密加解密"
      description="SM2 国密非对称加密算法，支持密钥对生成、公钥加密与私钥解密"
      :show-example="false"
    />

    <!-- 操作模式切换 -->
    <ModeTabGroup v-model="mode" :options="modeOptions" />

    <!-- 参数选择 -->
    <div class="flex gap-4 mb-4 flex-wrap">
      <SelectListbox
        v-model="cipherMode"
        label="密文模式"
        class="w-[140px]"
        :options="cipherModeOptions"
      />
      <SelectListbox
        v-if="mode !== 'generate'"
        v-model="dataFormat"
        :label="dataFormatLabel"
        class="w-[140px]"
        :options="dataFormatOptions"
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
          rows="3"
          placeholder="130 字符十六进制公钥（以 04 开头）"
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
          rows="3"
          placeholder="64 字符十六进制私钥"
        ></textarea>
      </div>
    </div>

    <!-- 操作按钮行 -->
    <div class="flex gap-2 items-center mb-4">
      <button
        class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isProcessing"
        @click="handleAction"
      >
        {{ actionButtonText }}
      </button>
      <ClearButton @clear="handleClear" />
    </div>

    <!-- 操作模式输入区域 -->
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
    </div>

    <!-- 错误信息 -->
    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <!-- 输出区域 -->
    <div v-if="outputText" class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ outputLabel }}</span>
        <CopyButton :text="outputText" label="复制结果" />
      </div>
      <div class="border border-border rounded-md p-4 bg-card">
        <code class="font-mono text-[0.8125rem] break-all text-text">{{ outputText }}</code>
      </div>
    </div>

    <!-- 算法说明 -->
    <div class="border-t border-border pt-4">
      <h3 class="text-[0.8125rem] text-muted font-medium">算法说明</h3>
      <div class="pt-2">
        <div class="text-[0.8125rem] text-muted leading-relaxed space-y-2">
          <p class="m-0">
            <strong>SM2</strong>：中国国密非对称加密算法（GM/T 0003-2012），基于 256 位 SM2 椭圆曲线。
            支持公钥加密与私钥解密，密钥为原始十六进制格式。
          </p>
          <p class="m-0">
            <strong>密钥格式</strong>：公钥 130 字符（以 "04" 开头的非压缩格式），私钥 64 字符。
          </p>
          <p class="m-0">
            <strong>密文模式</strong>：C1C3C2（默认，国密标准推荐）和 C1C2C3（旧版兼容）。
            加密和解密须使用相同模式，否则解密会失败。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
