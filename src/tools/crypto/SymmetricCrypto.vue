<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { encryptAES, decryptAES, type AESAlgorithm, type AESKeyLength } from '../../utils/crypto/crypto';

type Mode = 'encrypt' | 'decrypt';

const mode = ref<Mode>('encrypt');
const algorithm = ref<AESAlgorithm>('AES-GCM');
const keyLength = ref<AESKeyLength>(256);
const plaintext = ref('');
const ciphertext = ref('');
const password = ref('');
const output = ref('');
const errorMsg = ref('');
const isProcessing = ref(false);

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
      output.value = await encryptAES(plaintext.value, password.value, algorithm.value, keyLength.value);
    } else {
      output.value = await decryptAES(ciphertext.value, password.value, algorithm.value, keyLength.value);
    }
  } catch {
    errorMsg.value = mode.value === 'encrypt' ? '加密失败，请检查输入' : '解密失败，请检查密码或密文是否正确';
  } finally {
    isProcessing.value = false;
  }
}

function switchMode(newMode: Mode) {
  mode.value = newMode;
  output.value = '';
  errorMsg.value = '';
}

function handleExample() {
  mode.value = 'encrypt';
  algorithm.value = 'AES-GCM';
  keyLength.value = 256;
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
    <ToolHeader title="对称加解密" description="支持 AES 等主流对称加密算法的加解密" @example="handleExample" />

    <div class="flex gap-1 mb-4">
      <button :class="['px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150', mode === 'encrypt' ? 'bg-accent text-white border-accent' : 'bg-card text-text border-border']" @click="switchMode('encrypt')">加密</button>
      <button :class="['px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150', mode === 'decrypt' ? 'bg-accent text-white border-accent' : 'bg-card text-text border-border']" @click="switchMode('decrypt')">解密</button>
    </div>

    <div class="flex gap-4 mb-4 flex-wrap">
      <div class="flex flex-col gap-1">
        <label class="field-label">算法</label>
        <select v-model="algorithm" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans outline-none cursor-pointer focus:border-accent">
          <option value="AES-GCM">AES-GCM</option>
          <option value="AES-CBC">AES-CBC</option>
          <option value="AES-CTR">AES-CTR</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label">密钥长度</label>
        <select v-model.number="keyLength" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans outline-none cursor-pointer focus:border-accent">
          <option :value="128">128 位</option>
          <option :value="192">192 位</option>
          <option :value="256">256 位</option>
        </select>
      </div>
    </div>

    <div class="mb-4">
      <div class="mb-2">
        <label class="field-label">{{ mode === 'encrypt' ? '明文' : '密文（Base64）' }}</label>
        <textarea v-if="mode === 'encrypt'" v-model="plaintext" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="4" placeholder="输入要加密的文本"></textarea>
        <textarea v-else v-model="ciphertext" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="4" placeholder="输入 Base64 编码的密文"></textarea>
      </div>
      <div>
        <label class="field-label">密码</label>
        <input v-model="password" type="password" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent" placeholder="输入加密密码" />
      </div>
    </div>

    <div class="flex gap-2 items-center mb-4">
      <button class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isProcessing" @click="execute">
        {{ isProcessing ? '处理中...' : (mode === 'encrypt' ? '加密' : '解密') }}
      </button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <div v-if="output" class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ mode === 'encrypt' ? '密文' : '明文' }}</span>
        <CopyButton :text="output" label="复制结果" />
      </div>
      <div class="border border-border rounded-md p-4 bg-card">
        <code class="font-mono text-[0.8125rem] break-all text-text">{{ output }}</code>
      </div>
    </div>

    <details class="mt-6 border-t border-border pt-4">
      <summary class="cursor-pointer text-[0.8125rem] text-muted hover:text-text">高级选项</summary>
      <div class="pt-2">
        <p class="text-[0.8125rem] text-muted m-0 leading-relaxed">
          当前算法：<strong>{{ algorithm }}</strong>，密钥长度：<strong>{{ keyLength }} 位</strong>。
          密码通过 PBKDF2（100000 次迭代，SHA-256）派生为 AES 密钥。
          加密结果格式：Base64(salt[16B] + iv[{{ algorithm === 'AES-GCM' ? '12' : '16' }}B] + ciphertext)。
        </p>
      </div>
    </details>
  </div>
</template>
