<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import Bowser from 'bowser';

interface InfoItem {
  label: string;
  value: string;
}

const deviceItems = ref<InfoItem[]>([]);
const customUA = ref('');
const customItems = ref<InfoItem[]>([]);

/** 收集当前设备信息 */
function collectDeviceInfo() {
  const ua = navigator.userAgent;
  const parser = Bowser.getParser(ua);
  const browser = parser.getBrowser();
  const engine = parser.getEngine();
  const os = parser.getOS();
  const platform = parser.getPlatform();

  deviceItems.value = [
    { label: '浏览器', value: `${browser.name ?? '未知'} ${browser.version ?? ''}` },
    { label: '渲染引擎', value: `${engine.name ?? '未知'} ${engine.version ?? ''}` },
    { label: '操作系统', value: `${os.name ?? '未知'} ${os.version ?? ''}` },
    { label: '设备类型', value: platform.type ?? '未知' },
    { label: '屏幕分辨率', value: `${screen.width} × ${screen.height}` },
    { label: '可用区域', value: `${screen.availWidth} × ${screen.availHeight}` },
    { label: '色深', value: `${screen.colorDepth} 位` },
    { label: '浏览器语言', value: navigator.language },
    { label: 'Cookie', value: navigator.cookieEnabled ? '已启用' : '已禁用' },
    { label: '在线状态', value: navigator.onLine ? '在线' : '离线' },
    { label: 'UserAgent', value: ua },
  ];
}

/** 解析自定义 UA */
function parseCustomUA() {
  if (!customUA.value.trim()) {
    customItems.value = [];
    return;
  }
  try {
    const parser = Bowser.getParser(customUA.value);
    const browser = parser.getBrowser();
    const engine = parser.getEngine();
    const os = parser.getOS();
    const platform = parser.getPlatform();

    customItems.value = [
      { label: '浏览器', value: `${browser.name ?? '未知'} ${browser.version ?? ''}` },
      { label: '渲染引擎', value: `${engine.name ?? '未知'} ${engine.version ?? ''}` },
      { label: '操作系统', value: `${os.name ?? '未知'} ${os.version ?? ''}` },
      { label: '设备类型', value: platform.type ?? '未知' },
    ];
  } catch {
    customItems.value = [{ label: '错误', value: '无法解析该 UserAgent 字符串' }];
  }
}

const allInfoJson = computed(() => {
  const obj: Record<string, string> = {};
  for (const item of deviceItems.value) {
    obj[item.label] = item.value;
  }
  return JSON.stringify(obj, null, 2);
});

function clearCustomUA() {
  customUA.value = '';
  customItems.value = [];
}

onMounted(() => {
  collectDeviceInfo();
});
</script>

<template>
  <div class="device-tool">
    <ToolHeader
      title="设备信息与 UserAgent"
      description="查看浏览器、操作系统、屏幕等设备信息"
      :show-example="false"
    />

    <div class="info-grid">
      <div v-for="item in deviceItems" :key="item.label" class="info-card">
        <span class="info-label">{{ item.label }}</span>
        <span :class="['info-value', { mono: item.label === 'UserAgent' }]">{{ item.value }}</span>
      </div>
    </div>

    <div class="copy-bar">
      <CopyButton :text="allInfoJson" label="复制 JSON" />
    </div>

    <div class="custom-section">
      <h2 class="section-title">自定义 UA 解析</h2>
      <textarea
        v-model="customUA"
        class="field-textarea"
        rows="2"
        placeholder="粘贴 UserAgent 字符串进行解析..."
        @input="parseCustomUA"
      ></textarea>
      <ClearButton v-if="customUA" @clear="clearCustomUA" />
      <div v-if="customItems.length" class="info-grid">
        <div v-for="item in customItems" :key="item.label" class="info-card">
          <span class="info-label">{{ item.label }}</span>
          <span class="info-value">{{ item.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-tool { max-width: 720px; }

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.info-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
}

.info-card:has(.mono) {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 0.875rem;
  color: var(--color-text);
  word-break: break-all;
}

.info-value.mono {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.copy-bar { margin-bottom: var(--space-xl); }

.custom-section {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-lg);
}

.section-title {
  margin: 0 0 var(--space-md);
  font-size: 1rem;
  font-weight: 600;
}

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: var(--space-md);
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

@media (max-width: 767px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
