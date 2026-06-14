<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import Bowser from 'bowser';
import {
  uaTemplates,
  uaCategories,
  filterTemplates,
  getBrowsersByPlatform,
  type UATemplate,
} from '../../utils/network/ua-templates';

interface InfoItem {
  label: string;
  value: string;
}

// ─── 当前设备信息 ───
const deviceItems = ref<InfoItem[]>([]);
const allInfoJson = computed(() => {
  const obj: Record<string, string> = {};
  for (const item of deviceItems.value) { obj[item.label] = item.value; }
  return JSON.stringify(obj, null, 2);
});

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

// ─── UA 模板库 ───
const activePlatform = ref<'desktop' | 'mobile'>('desktop');
const activeBrowser = ref('');
const selectedTemplate = ref<UATemplate | null>(null);

const availableBrowsers = computed(() => getBrowsersByPlatform(activePlatform.value));

const filteredTemplates = computed(() =>
  filterTemplates(activePlatform.value, activeBrowser.value),
);

/** 切换平台时重置浏览器筛选 */
watch(activePlatform, () => {
  activeBrowser.value = '';
  selectedTemplate.value = null;
});

function selectTemplate(t: UATemplate) {
  selectedTemplate.value = t;
}

// ─── 模板解析结果 ───
const templateParsed = computed<InfoItem[] | null>(() => {
  if (!selectedTemplate.value) return null;
  try {
    const parser = Bowser.getParser(selectedTemplate.value.ua);
    const browser = parser.getBrowser();
    const engine = parser.getEngine();
    const os = parser.getOS();
    const platform = parser.getPlatform();
    return [
      { label: '浏览器', value: `${browser.name ?? '未知'} ${browser.version ?? ''}` },
      { label: '渲染引擎', value: `${engine.name ?? '未知'} ${engine.version ?? ''}` },
      { label: '操作系统', value: `${os.name ?? '未知'} ${os.version ?? ''}` },
      { label: '设备类型', value: platform.type ?? '未知' },
    ];
  } catch {
    return [{ label: '错误', value: '无法解析该 UserAgent 字符串' }];
  }
});

/** 将选中模板的 UA 填入自定义解析区 */
function fillToCustom() {
  if (!selectedTemplate.value) return;
  customUA.value = selectedTemplate.value.ua;
  parseCustomUA();
}

// ─── 自定义 UA 解析 ───
const customUA = ref('');
const customItems = ref<InfoItem[]>([]);

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

function clearCustomUA() {
  customUA.value = '';
  customItems.value = [];
}

// ─── 当前设备信息折叠 ───
const showDeviceInfo = ref(true);

onMounted(() => { collectDeviceInfo(); });
</script>

<template>
  <div class="w-full">
    <ToolHeader title="设备信息与UA" description="查看设备信息、解析与生成 UserAgent" :show-example="false" />

    <!-- 主体：左右分栏 -->
    <div class="flex gap-6 max-lg:flex-col">

      <!-- 左栏：筛选 + 模板列表 -->
      <div class="w-64 shrink-0 max-lg:w-full">
        <!-- 平台切换 -->
        <div class="flex gap-1 mb-3">
          <button
            v-for="cat in uaCategories"
            :key="cat.platform"
            :class="[
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors cursor-pointer',
              activePlatform === cat.platform
                ? 'bg-text text-surface border-text'
                : 'bg-card text-muted border-border hover:bg-hover hover:text-text',
            ]"
            @click="activePlatform = cat.platform"
          >
            {{ cat.label }}
          </button>
        </div>

        <!-- 浏览器筛选 -->
        <div class="flex flex-wrap gap-1.5 mb-3">
          <button
            :class="[
              'px-2.5 py-1 text-xs rounded-sm border transition-colors cursor-pointer',
              !activeBrowser
                ? 'bg-accent text-white border-accent'
                : 'bg-card text-muted border-border hover:bg-hover hover:text-text',
            ]"
            @click="activeBrowser = ''"
          >
            全部
          </button>
          <button
            v-for="b in availableBrowsers"
            :key="b"
            :class="[
              'px-2.5 py-1 text-xs rounded-sm border transition-colors cursor-pointer',
              activeBrowser === b
                ? 'bg-accent text-white border-accent'
                : 'bg-card text-muted border-border hover:bg-hover hover:text-text',
            ]"
            @click="activeBrowser = b"
          >
            {{ b }}
          </button>
        </div>

        <!-- 模板列表 -->
        <div class="flex flex-col gap-1 max-h-[520px] overflow-y-auto">
          <button
            v-for="t in filteredTemplates"
            :key="t.id"
            :class="[
              'text-left px-3 py-2 text-xs rounded-sm border transition-colors cursor-pointer',
              selectedTemplate?.id === t.id
                ? 'bg-text text-surface border-text'
                : 'bg-card text-text border-border hover:bg-hover',
            ]"
            @click="selectTemplate(t)"
          >
            <span class="font-medium">{{ t.browser }}</span>
            <span class="text-muted ml-1" :class="selectedTemplate?.id === t.id && 'text-surface/70'">{{ t.os }}</span>
          </button>
          <p v-if="!filteredTemplates.length" class="text-xs text-muted text-center py-4">暂无匹配模板</p>
        </div>
      </div>

      <!-- 右栏：详情 + 操作 -->
      <div class="flex-1 min-w-0">

        <!-- 选中模板详情 -->
        <div v-if="selectedTemplate" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="m-0 text-sm font-semibold">{{ selectedTemplate.name }}</h3>
            <span class="text-[0.6875rem] text-muted px-2 py-0.5 bg-hover rounded-sm">
              {{ selectedTemplate.platform === 'desktop' ? '桌面端' : '移动端' }}
            </span>
          </div>

          <!-- 解析结果卡片 -->
          <div v-if="templateParsed" class="grid grid-cols-2 gap-2 mb-4 max-sm:grid-cols-1">
            <div
              v-for="item in templateParsed"
              :key="item.label"
              class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card"
            >
              <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
              <span class="text-sm text-text break-all">{{ item.value }}</span>
            </div>
          </div>

          <!-- UA 全文 -->
          <div class="p-3 border border-border rounded-sm bg-card mb-4">
            <p class="m-0 text-xs font-mono text-text break-all leading-relaxed select-all">{{ selectedTemplate.ua }}</p>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-3">
            <CopyButton :text="selectedTemplate.ua" label="复制 UA" />
            <button
              class="px-3 py-1.5 text-xs font-medium rounded-sm border border-border bg-card text-text hover:bg-hover transition-colors cursor-pointer"
              @click="fillToCustom"
            >
              解析验证
            </button>
          </div>
        </div>

        <!-- 未选中模板时的占位 -->
        <div v-else class="flex items-center justify-center h-48 text-sm text-muted border border-dashed border-border rounded-sm mb-6">
          从左侧选择一个 UA 模板
        </div>

        <!-- 自定义 UA 解析 -->
        <div class="border-t border-border pt-5">
          <h3 class="m-0 mb-3 text-sm font-semibold">自定义 UA 解析</h3>
          <textarea
            v-model="customUA"
            class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent mb-3"
            rows="2"
            placeholder="粘贴 UserAgent 字符串进行解析..."
            @input="parseCustomUA"
          ></textarea>
          <div class="flex items-center gap-3 mb-4">
            <ClearButton v-if="customUA" @clear="clearCustomUA" />
            <CopyButton v-if="customUA" :text="customUA" label="复制 UA" />
          </div>
          <div v-if="customItems.length" class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <div
              v-for="item in customItems"
              :key="item.label"
              class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card"
            >
              <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
              <span class="text-sm text-text break-all" :class="item.label === '错误' && 'text-error'">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前设备信息（折叠面板） -->
    <div class="mt-8 border-t border-border pt-5">
      <button
        class="flex items-center gap-2 w-full text-left cursor-pointer bg-transparent border-none p-0"
        @click="showDeviceInfo = !showDeviceInfo"
      >
        <span
          :class="[
            'text-xs transition-transform inline-block',
            showDeviceInfo ? 'rotate-90' : '',
          ]"
        >▶</span>
        <h3 class="m-0 text-sm font-semibold">当前设备信息</h3>
      </button>

      <div v-if="showDeviceInfo" class="mt-3">
        <div class="grid grid-cols-2 gap-2 mb-4 max-sm:grid-cols-1">
          <div
            v-for="item in deviceItems"
            :key="item.label"
            :class="[
              'flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card',
              item.label === 'UserAgent' && 'col-span-2 max-sm:col-span-1',
            ]"
          >
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
            <span :class="['text-sm text-text break-all', item.label === 'UserAgent' && 'font-mono text-xs']">{{ item.value }}</span>
          </div>
        </div>
        <CopyButton :text="allInfoJson" label="复制 JSON" />
      </div>
    </div>
  </div>
</template>
