<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { encryptAES, decryptAES, type AESAlgorithm, type AESKeyLength } from '../utils/crypto';

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
const showAdvanced = ref(false);

async function execute() {
  errorMsg.value = '';
  output.value = '';

  if (mode.value === 'encrypt') {
    if (!plaintext.value) {
      errorMsg.value = '请输入要加密的明文';
      return;
    }
    if (!password.value) {
      errorMsg.value = '请输入密码';
      return;
    }
  } else {
    if (!ciphertext.value) {
      errorMsg.value = '请输入要解密的密文';
      return;
    }
    if (!password.value) {
      errorMsg.value = '请输入密码';
      return;
    }
  }

  isProcessing.value = true;
  try {
    if (mode.value === 'encrypt') {
      output.value = await encryptAES(plaintext.value, password.value, algorithm.value, keyLength.value);
    } else {
      output.value = await decryptAES(ciphertext.value, password.value, algorithm.value, keyLength.value);
    }
  } catch {
    errorMsg.value = mode.value === 'encrypt'
      ? '加密失败，请检查输入'
      : '解密失败，请检查密码或密文是否正确';
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
  <div class="crypto-tool">
    <ToolHeader
      title="对称加解密"
      description="支持 AES 等主流对称加密算法的加解密"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: mode === 'encrypt' }]" @click="switchMode('encrypt')">加密</button>
      <button :class="['tab-btn', { active: mode === 'decrypt' }]" @click="switchMode('decrypt')">解密</button>
    </div>

    <div class="controls-row">
      <div class="control-group">
        <label class="field-label">算法</label>
        <select v-model="algorithm" class="field-select">
          <option value="AES-GCM">AES-GCM</option>
          <option value="AES-CBC">AES-CBC</option>
          <option value="AES-CTR">AES-CTR</option>
        </select>
      </div>
      <div class="control-group">
        <label class="field-label">密钥长度</label>
        <select v-model.number="keyLength" class="field-select">
          <option :value="128">128 位</option>
          <option :value="192">192 位</option>
          <option :value="256">256 位</option>
        </select>
      </div>
    </div>

    <div class="io-section">
      <div class="io-block">
        <label class="field-label">{{ mode === 'encrypt' ? '明文' : '密文（Base64）' }}</label>
        <textarea
          v-if="mode === 'encrypt'"
          v-model="plaintext"
          class="field-textarea"
          rows="4"
          placeholder="输入要加密的文本"
        ></textarea>
        <textarea
          v-else
          v-model="ciphertext"
          class="field-textarea"
          rows="4"
          placeholder="输入 Base64 编码的密文"
        ></textarea>
      </div>

      <div class="io-block">
        <label class="field-label">密码</label>
        <input v-model="password" type="password" class="field-input" style="width:100%" placeholder="输入加密密码" />
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-primary" :disabled="isProcessing" @click="execute">
        {{ isProcessing ? '处理中...' : (mode === 'encrypt' ? '加密' : '解密') }}
      </button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="output" class="output-section">
      <div class="output-header">
        <span class="output-label">{{ mode === 'encrypt' ? '密文' : '明文' }}</span>
        <CopyButton :text="output" label="复制结果" />
      </div>
      <div class="output-box">
        <code class="output-value">{{ output }}</code>
      </div>
    </div>

    <details class="advanced-panel">
      <summary class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        高级选项
      </summary>
      <div class="advanced-content">
        <p class="advanced-hint">
          当前算法：<strong>{{ algorithm }}</strong>，密钥长度：<strong>{{ keyLength }} 位</strong>。
          密码通过 PBKDF2（100000 次迭代，SHA-256）派生为 AES 密钥。
          加密结果格式：Base64(salt[16B] + iv[{{ algorithm === 'AES-GCM' ? '12' : '16' }}B] + ciphertext)。
        </p>
      </div>
    </details>
  </div>
</template>

<style scoped>
.crypto-tool { max-width: 720px; }

.mode-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn.active {
  background-color: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.controls-row {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.io-section { margin-bottom: var(--space-md); }

.io-block { margin-bottom: var(--space-sm); }

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus,
.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label { font-size: 0.875rem; font-weight: 500; }

.output-box {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.output-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}

.advanced-panel {
  margin-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.advanced-toggle {
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.advanced-toggle:hover { color: var(--color-text); }

.advanced-content {
  padding-top: var(--space-sm);
}

.advanced-hint {
  font-size: 0.8125rem;
  color: var(--color-muted);
  margin: 0;
  line-height: 1.6;
}
</style>
