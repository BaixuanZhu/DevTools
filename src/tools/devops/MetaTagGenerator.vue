<script setup lang="ts">
/**
 * Meta 标签生成器主组件。
 *
 * 左侧表单输入标题/描述/关键词/URL/图片等字段，右侧通过 Tab 切换：
 * 「社交预览」实时展示 6 种平台分享卡片，「Meta 代码」按 Basic / OG /
 * Twitter Card / JSON-LD 四类输出可复制的标签文本。
 */
import { reactive, ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import SocialPreviewCard from './SocialPreviewCard.vue';
import { useCopy } from '../../composables/useCopy';
import {
  DEFAULT_META_FORM,
  generateBasicMeta,
  generateOpenGraph,
  generateTwitterCard,
  generateJsonLd,
  generateAllMetaTags,
  parseKeywords,
  isValidHttpUrl,
  type MetaFormData,
  type SocialPlatform,
  type OgType,
  type TwitterCard,
  type JsonLdType,
} from '../../utils/devops/meta-generator';

/** 表单数据（reactive，字段变更即触发预览/代码重算） */
const form = reactive<MetaFormData>({ ...DEFAULT_META_FORM });

/** 输出区顶层视图：社交预览 / Meta 代码 */
const topView = ref<'social' | 'code'>('social');
/** 当前预览的社交平台 */
const platform = ref<SocialPlatform>('facebook');
/** 当前查看的代码类型 */
const codeType = ref<'basic' | 'og' | 'twitter' | 'jsonld'>('basic');
/** 是否展开高级选项 */
const showAdvanced = ref(false);

/** og:type 可选项 */
const ogTypeOptions: { value: OgType; label: string }[] = [
  { value: 'website', label: 'website' },
  { value: 'article', label: 'article' },
  { value: 'profile', label: 'profile' },
  { value: 'book', label: 'book' },
];

/** Twitter Card 类型可选项 */
const twitterCardOptions: { value: TwitterCard; label: string }[] = [
  { value: 'summary', label: 'summary' },
  { value: 'summary_large_image', label: 'summary_large_image' },
  { value: 'player', label: 'player' },
  { value: 'app', label: 'app' },
];

/** JSON-LD 类型可选项 */
const jsonLdTypeOptions: { value: JsonLdType; label: string }[] = [
  { value: 'Article', label: 'Article' },
  { value: 'WebSite', label: 'WebSite' },
];

/** 社交平台分段选择器项 */
const platformOptions: { key: SocialPlatform; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'x', label: 'X' },
  { key: 'wechat', label: '微信' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'slack', label: 'Slack' },
];

/** 代码类型分段选择器项 */
const codeTypeOptions: { key: typeof codeType.value; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'og', label: 'OG' },
  { key: 'twitter', label: 'Twitter' },
  { key: 'jsonld', label: 'JSON-LD' },
];

/** 按 codeType 返回当前激活的代码文本 */
const activeCode = computed(() => {
  switch (codeType.value) {
    case 'basic':
      return generateBasicMeta(form);
    case 'og':
      return generateOpenGraph(form);
    case 'twitter':
      return generateTwitterCard(form);
    case 'jsonld':
      return generateJsonLd(form);
    default:
      return '';
  }
});

/** 代码区中文标题，随 codeType 切换 */
const codeLabel = computed(() => {
  switch (codeType.value) {
    case 'basic':
      return '基础 Meta';
    case 'og':
      return 'Open Graph';
    case 'twitter':
      return 'Twitter Card';
    case 'jsonld':
      return 'JSON-LD';
    default:
      return '';
  }
});

/** 关键词 chips 预览（解析后去重保序） */
const keywordChips = computed(() => parseKeywords(form.keywords));

/**
 * 规范 URL 内联提示：非空且非合法 http(s) URL 时给出建议文案，否则空串。
 * 仅提示，不阻断生成。
 */
const urlHint = computed(() => {
  const raw = form.canonicalUrl.trim();
  if (raw === '') return '';
  return isValidHttpUrl(raw) ? '' : '建议使用完整 URL（以 https:// 开头）';
});

const { copy: copyAll } = useCopy();

/** 复制 Basic + OG + Twitter 组合标签到剪贴板 */
function handleCopyAll(): void {
  copyAll(generateAllMetaTags(form));
}

/**
 * 清空所有用户输入。
 *
 * 文本字段全部置为空串，三个枚举（og:type / twitter:card / JSON-LD 类型）
 * 重置为最中性的基线值，使表单回到"无内容"状态，而非默认示例值。
 */
function handleClear(): void {
  form.title = '';
  form.description = '';
  form.keywords = '';
  form.canonicalUrl = '';
  form.imageUrl = '';
  form.imageAlt = '';
  form.siteName = '';
  form.twitterSite = '';
  form.twitterCreator = '';
  form.ogType = 'website';
  form.twitterCard = 'summary';
  form.jsonLdType = 'Article';
}
</script>

<template>
  <div>
    <ToolHeader
      title="Meta 标签生成器"
      description="填写表单实时生成 Basic / Open Graph / Twitter Card / JSON-LD 标签，并预览社交分享卡片"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入表单 -->
      <template #input>
        <div class="bg-card border border-border rounded-lg p-6 space-y-4">
          <!-- 标题 -->
          <div>
            <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-title">标题</label>
            <input
              id="meta-title"
              v-model="form.title"
              type="text"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="页面标题"
            />
          </div>

          <!-- 描述 -->
          <div>
            <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-desc">描述</label>
            <textarea
              id="meta-desc"
              v-model="form.description"
              rows="3"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm resize-y box-border focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="页面描述，建议 70-160 字"
            ></textarea>
          </div>

          <!-- 关键词 -->
          <div>
            <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-keywords">关键词</label>
            <input
              id="meta-keywords"
              v-model="form.keywords"
              type="text"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="用逗号分隔，如：vue, 前端, 工具"
            />
            <div v-if="keywordChips.length" class="flex flex-wrap gap-1.5 mt-2">
              <span
                v-for="chip in keywordChips"
                :key="chip"
                class="chip chip-default"
                style="cursor: default; padding: 2px 10px; font-size: 0.75rem;"
              >{{ chip }}</span>
            </div>
          </div>

          <!-- 规范 URL -->
          <div>
            <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-canonical">规范 URL</label>
            <input
              id="meta-canonical"
              v-model="form.canonicalUrl"
              type="text"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="https://example.com/article"
            />
            <p v-if="urlHint" class="text-[0.8125rem] text-error m-0 mt-1">{{ urlHint }}</p>
          </div>

          <!-- 预览图 URL -->
          <div>
            <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-image">预览图 URL</label>
            <input
              id="meta-image"
              v-model="form.imageUrl"
              type="text"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="https://example.com/og.png（建议 1200×630）"
            />
          </div>

          <!-- 图片 Alt -->
          <div>
            <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-alt">图片 Alt</label>
            <input
              id="meta-alt"
              v-model="form.imageAlt"
              type="text"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="配图替代文本"
            />
          </div>

          <!-- 高级选项开关 -->
          <ToggleSwitch v-model="showAdvanced" label="高级选项" />

          <!-- 高级选项展开区 -->
          <div v-if="showAdvanced" class="space-y-4 pt-2 border-t border-border">
            <!-- 站点名 -->
            <div>
              <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-site">站点名称</label>
              <input
                id="meta-site"
                v-model="form.siteName"
                type="text"
                class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                placeholder="og:site_name"
              />
            </div>

            <!-- og:type -->
            <div>
              <span class="block mb-1 text-[0.8125rem] text-muted">og:type</span>
              <SelectListbox v-model="form.ogType" :options="ogTypeOptions" class="w-full" />
            </div>

            <!-- Twitter 卡片类型 -->
            <div>
              <span class="block mb-1 text-[0.8125rem] text-muted">Twitter 卡片类型</span>
              <SelectListbox v-model="form.twitterCard" :options="twitterCardOptions" class="w-full" />
            </div>

            <!-- twitter:site -->
            <div>
              <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-tw-site">twitter:site</label>
              <input
                id="meta-tw-site"
                v-model="form.twitterSite"
                type="text"
                class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                placeholder="@handle"
              />
            </div>

            <!-- twitter:creator -->
            <div>
              <label class="block mb-1 text-[0.8125rem] text-muted" for="meta-tw-creator">twitter:creator</label>
              <input
                id="meta-tw-creator"
                v-model="form.twitterCreator"
                type="text"
                class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                placeholder="@author"
              />
            </div>

            <!-- JSON-LD 类型 -->
            <div>
              <span class="block mb-1 text-[0.8125rem] text-muted">JSON-LD 类型</span>
              <SelectListbox v-model="form.jsonLdType" :options="jsonLdTypeOptions" class="w-full" />
            </div>
          </div>

          <!-- 清空按钮 -->
          <div class="pt-2">
            <button
              type="button"
              class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
              @click="handleClear"
            >
              清空
            </button>
          </div>
        </div>
      </template>

      <!-- 输出区：Tab 切换社交预览 / Meta 代码 -->
      <template #output>
        <ModeTabGroup
          v-model="topView"
          :options="[{ key: 'social', label: '社交预览' }, { key: 'code', label: 'Meta 代码' }]"
        >
          <!-- 社交预览 -->
          <template #social>
            <!-- 平台分段选择器 -->
            <div class="inline-flex rounded-sm border border-border overflow-hidden mb-4">
              <button
                v-for="opt in platformOptions"
                :key="opt.key"
                type="button"
                :class="[
                  'px-3 py-1.5 text-[0.8125rem] transition-[background-color,color] duration-150 cursor-pointer',
                  platform === opt.key
                    ? 'bg-accent text-white'
                    : 'bg-card text-muted hover:bg-hover hover:text-text',
                ]"
                @click="platform = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>
            <SocialPreviewCard :platform="platform" :data="form" />
          </template>

          <!-- Meta 代码 -->
          <template #code>
            <!-- 右上角复制全部 -->
            <div class="flex justify-end mb-2">
              <button
                type="button"
                class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                @click="handleCopyAll"
              >
                复制全部
              </button>
            </div>

            <!-- 代码类型分段选择器 -->
            <div class="inline-flex rounded-sm border border-border overflow-hidden mb-4">
              <button
                v-for="opt in codeTypeOptions"
                :key="opt.key"
                type="button"
                :class="[
                  'px-3 py-1.5 text-[0.8125rem] transition-[background-color,color] duration-150 cursor-pointer',
                  codeType === opt.key
                    ? 'bg-accent text-white'
                    : 'bg-card text-muted hover:bg-hover hover:text-text',
                ]"
                @click="codeType = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>

            <CodePanel :label="codeLabel" :copy-text="activeCode" show-copy>
              <pre class="w-full p-4 bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap break-all">{{ activeCode }}</pre>
            </CodePanel>
          </template>
        </ModeTabGroup>
      </template>
    </ResponsiveWorkspace>

    <!-- 底部状态行：URL 校验提示 -->
    <div class="mx-auto w-full max-w-400 mt-4 text-center">
      <p v-if="urlHint" class="text-[0.8125rem] text-error m-0">{{ urlHint }}</p>
    </div>
  </div>
</template>
