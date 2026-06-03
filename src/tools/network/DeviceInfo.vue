<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import Bowser from 'bowser';

interface InfoItem {
  label: string;
  value: string;
}

const deviceItems = ref<InfoItem[]>([]);
const customUA = ref('');
const customItems = ref<InfoItem[]>([]);

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

function parseCustomUA() {
  if (!customUA.value.trim()) { customItems.value = []; return; }
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
  for (const item of deviceItems.value) { obj[item.label] = item.value; }
  return JSON.stringify(obj, null, 2);
});

function clearCustomUA() {
  customUA.value = '';
  customItems.value = [];
}

onMounted(() => { collectDeviceInfo(); });
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader title="设备信息与 UserAgent" description="查看浏览器、操作系统、屏幕等设备信息" :show-example="false" />

    <div class="grid grid-cols-2 gap-2 mb-4 max-md:grid-cols-1">
      <div v-for="item in deviceItems" :key="item.label" :class="['flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card', item.label === 'UserAgent' && 'col-span-2 max-md:col-span-1']">
        <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
        <span :class="['text-sm text-text break-all', item.label === 'UserAgent' && 'font-mono text-xs']">{{ item.value }}</span>
      </div>
    </div>

    <div class="mb-8">
      <CopyButton :text="allInfoJson" label="复制 JSON" />
    </div>

    <div class="border-t border-border pt-6">
      <h2 class="m-0 mb-4 text-base font-semibold">自定义 UA 解析</h2>
      <textarea v-model="customUA" class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent mb-4" rows="2" placeholder="粘贴 UserAgent 字符串进行解析..." @input="parseCustomUA"></textarea>
      <ClearButton v-if="customUA" @clear="clearCustomUA" />
      <div v-if="customItems.length" class="grid grid-cols-2 gap-2 mt-4 max-md:grid-cols-1">
        <div v-for="item in customItems" :key="item.label" class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
          <span class="text-sm text-text break-all">{{ item.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
