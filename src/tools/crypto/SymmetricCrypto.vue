<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import DisclosureSection from '../../components/ui/DisclosureSection.vue';
import { encrypt, decrypt } from '../../utils/crypto/crypto';
import { getAlgorithm, ALL_ALGORITHM_IDS } from '../../utils/crypto/algorithms/registry';
import type { AlgorithmId } from '../../utils/crypto/algorithms/types';
import type { OutputFormat } from '../../utils/shared/array-buffer';

type Mode = 'encrypt' | 'decrypt';

const mode = ref<Mode>('encrypt');
const algorithm = ref<AlgorithmId>('AES-GCM');
const format = ref<OutputFormat>('base64');
const plaintext = ref('');
const ciphertext = ref('');
const password = ref('');
const output = ref('');
const errorMsg = ref('');
const keyLength = ref<number>(256);
const isProcessing = ref(false);

/** 当前算法适配器 */
const currentAlgo = computed(() => getAlgorithm(algorithm.value));

/** 是否显示密钥长度选择（算法有多种密钥长度时显示） */
const showKeyLength = computed(() => currentAlgo.value.keyLengths.length > 1);

/** 密钥长度选项 */
const keyLengthOptions = computed(() =>
  currentAlgo.value.keyLengths.map((len) => ({ value: len, label: `${len} 位` })),
);

/** 格式选择器标签（根据加解密模式变化） */
const formatLabel = computed(() => (mode.value === 'encrypt' ? '输出格式' : '输入格式'));

/** 解密模式下的 textarea 占位符 */
const ciphertextPlaceholder = computed(() => {
  if (format.value === 'base64') return '输入 Base64 编码的密文';
  return '输入 Hex 编码的密文';
});

/** 高级选项中的二进制格式描述 */
const binaryFormatDesc = computed(() => {
  const a = currentAlgo.value;
  const tagInfo = a.isAead ? '+tag' : '';
  return `salt[16B] + iv[${a.ivLength}B] + ciphertext${tagInfo}`;
});

/** 算法下拉选项 */
const algorithmOptions = computed(() =>
  ALL_ALGORITHM_IDS.map((id) => {
    const algo = getAlgorithm(id);
    return { value: id, label: algo.label };
  }),
);

// 切换模式时清空输出
watch(mode, () => {
  output.value = '';
  errorMsg.value = '';
});

// 切换算法时清空输出并重置密钥长度为该算法的默认值
watch(algorithm, () => {
  output.value = '';
  errorMsg.value = '';
  keyLength.value = currentAlgo.value.defaultKeyLength;
});

async function execute() {
  errorMsg.value = '';
  output.value = '';

  if (mode.value === 'encrypt') {
    if (!plaintext.value) { errorMsg.value = '请输入要加密的明文'; return; }
    if (!password.value) { errorMsg.value = '请输入密码'; return; }
  } else {
    if (!ciphertext.value) { errorMsg.value = '请输入要解密的密文'; return; }
    if (!password.value) { errorMsg.value = '请输入密码'; return; }
  }

  isProcessing.value = true;
  try {
    if (mode.value === 'encrypt') {
      output.value = await encrypt(plaintext.value, password.value, algorithm.value, keyLength.value, format.value);
    } else {
      output.value = await decrypt(ciphertext.value, password.value, algorithm.value, keyLength.value, format.value);
    }
  } catch {
    errorMsg.value = mode.value === 'encrypt' ? '加密失败，请检查输入' : '解密失败，请检查密码或密文是否正确';
  } finally {
    isProcessing.value = false;
  }
}

function handleExample() {
  mode.value = 'encrypt';
  algorithm.value = 'AES-GCM';
  format.value = 'base64';
  plaintext.value = 'Hello, DevTools! 你好，开发者工具！';
  password.value = 'my-secret-password';
  execute();
}

function handleClear() {
  plaintext.value = '';
  ciphertext.value = '';
  password.value = '';
  output.value = '';
  errorMsg.value = '';
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader title="对称加解密" description="支持 AES、SM4、ChaCha20、DES 等对称加密算法的加解密" @example="handleExample" />

    <ModeTabGroup v-model="mode" :options="[{ key: 'encrypt', label: '加密' }, { key: 'decrypt', label: '解密' }]" />

    <div class="flex gap-4 mb-4 flex-wrap">
      <SelectListbox v-model="algorithm" label="算法" class="w-[200px]" :options="algorithmOptions" />
      <SelectListbox v-if="showKeyLength" v-model="keyLength" label="密钥长度" class="w-[140px]" :options="keyLengthOptions" />
    </div>

    <!-- 格式选择器 -->
    <div class="mb-4">
      <SelectListbox
        v-model="format"
        :label="formatLabel"
        :options="[
          { value: 'base64', label: 'Base64' },
          { value: 'hex', label: '小写 Hex' },
          { value: 'hexUpper', label: '大写 HEX' },
        ]"
      />
    </div>

    <div class="mb-4">
      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">{{ mode === 'encrypt' ? '明文' : '密文' }}</label>
        <textarea v-if="mode === 'encrypt'" v-model="plaintext" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="4" placeholder="输入要加密的文本"></textarea>
        <textarea v-else v-model="ciphertext" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="4" :placeholder="ciphertextPlaceholder"></textarea>
      </div>
      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">密码</label>
        <input v-model="password" type="password" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent" placeholder="输入加密密码" />
      </div>

      <!-- 操作按钮行 -->
      <div class="flex gap-2 items-center mb-4">
        <button class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isProcessing" @click="execute">
          {{ isProcessing ? '处理中...' : (mode === 'encrypt' ? '加密' : '解密') }}
        </button>
        <ClearButton @clear="handleClear" />
      </div>

      <!-- 错误信息 -->
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

      <!-- 输出区域 -->
      <div v-if="output" class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">{{ mode === 'encrypt' ? '密文' : '明文' }}</span>
          <CopyButton :text="output" label="复制结果" />
        </div>
        <div class="border border-border rounded-md p-4 bg-card">
          <code class="font-mono text-[0.8125rem] break-all text-text">{{ output }}</code>
        </div>
      </div>
    </div>

    <DisclosureSection title="高级选项" class="mt-4">
      <p class="text-[0.8125rem] text-muted m-0 leading-relaxed">
        当前算法：<strong>{{ currentAlgo.label }}</strong>，密钥长度：<strong>{{ keyLength }} 位</strong>。
        密码通过 PBKDF2（100000 次迭代，SHA-256）派生为加密密钥。
        二进制格式：{{ binaryFormatDesc }}。
      </p>
    </DisclosureSection>
  </div>
</template>
