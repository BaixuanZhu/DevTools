<script setup lang="ts">
/**
 * 社交分享卡片预览组件。
 *
 * 根据 `platform` 用纯 CSS 模拟 6 种社交平台的链接展开（unfurl）外观：
 * facebook / x / wechat / linkedin / telegram / slack。仅依赖 `data` 中的
 * 文本与图片字段，不发起任何网络请求；图片加载失败或 URL 为空时渲染占位块。
 */
import { ref, watch, computed } from 'vue';
import { Image } from '@lucide/vue';
import type { MetaFormData, SocialPlatform } from '../../utils/devops/meta-generator';

interface Props {
  /** 目标社交平台，决定卡片视觉风格 */
  platform: SocialPlatform;
  /** 表单数据，提供标题/描述/图片等预览来源 */
  data: MetaFormData;
}

const props = defineProps<Props>();

/** 图片是否加载失败（或 URL 为空）；切换图片后自动重置以重试 */
const imgError = ref(false);

watch(
  () => props.data.imageUrl,
  () => {
    imgError.value = false;
  },
);

/**
 * 提取规范 URL 的主机名用于卡片底部展示。
 *
 * 解析失败时回退到原值；若原值也为空则返回占位 example.com。
 * @returns 小写灰字展示用的域名文本
 */
const hostname = computed(() => {
  const raw = props.data.canonicalUrl.trim();
  if (raw === '') return 'example.com';
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw;
  }
});

/** 是否有可用图片（URL 非空且未发生加载错误） */
const hasImage = computed(() => props.data.imageUrl.trim() !== '' && !imgError.value);

/** 标题占位文本（为空时给出灰色提示，避免塌陷） */
const titleText = computed(() => props.data.title.trim() || '无标题');
/** 标题是否为占位态（影响颜色） */
const isTitlePlaceholder = computed(() => props.data.title.trim() === '');
/** 描述占位文本 */
const descText = computed(() => props.data.description.trim() || '暂无描述');
/** 站点名占位文本 */
const siteText = computed(() => props.data.siteName.trim() || hostname.value);

/** 图片替代文本，优先使用 imageAlt，回退到 title */
const imgAlt = computed(() => props.data.imageAlt.trim() || props.data.title.trim() || '预览图');

/** 处理图片加载错误，触发占位块渲染 */
function onImgError(): void {
  imgError.value = true;
}
</script>

<template>
  <div class="bg-card border border-border rounded-lg p-6">
    <!-- 通用图片标记片段：可用时渲染 <img>，否则渲染占位块 -->
    <!-- Facebook：域名 + 大图 + 标题 + 描述 + 底栏 favicon 圆点 + siteName -->
    <div v-if="platform === 'facebook'" class="max-w-[500px]">
      <div class="text-[0.6875rem] text-[#65676b] uppercase tracking-wide truncate">{{ hostname }}</div>
      <div v-if="hasImage" class="aspect-[16/9] w-full bg-hover overflow-hidden mt-1.5">
        <img :src="data.imageUrl" :alt="imgAlt" loading="lazy" class="w-full h-full object-cover" @error="onImgError" />
      </div>
      <div v-else class="aspect-[16/9] w-full bg-hover flex flex-col items-center justify-center gap-2 text-muted mt-1.5">
        <Image :size="28" :stroke-width="1.6" />
        <span class="text-[0.75rem]">暂无预览图</span>
      </div>
      <div class="bg-hover px-3 pt-2.5 pb-3">
        <div class="text-[1.0625rem] font-bold leading-snug break-words" :class="isTitlePlaceholder ? 'text-muted' : 'text-text'">{{ titleText }}</div>
        <p class="text-[0.8125rem] text-[#65676b] leading-snug m-0 mt-1 line-clamp-2 break-words">{{ descText }}</p>
        <div class="flex items-center gap-2 mt-2">
          <span class="inline-block w-3.5 h-3.5 rounded-full bg-accent shrink-0"></span>
          <span class="text-[0.75rem] text-[#65676b] truncate">{{ siteText }}</span>
        </div>
      </div>
    </div>

    <!-- X (Twitter) summary_large_image：大图 + 域名 + 标题 + 描述 -->
    <div v-else-if="platform === 'x'" class="max-w-[500px]">
      <div v-if="hasImage" class="aspect-[16/9] w-full bg-hover overflow-hidden rounded-t-sm">
        <img :src="data.imageUrl" :alt="imgAlt" loading="lazy" class="w-full h-full object-cover" @error="onImgError" />
      </div>
      <div v-else class="aspect-[16/9] w-full bg-hover flex flex-col items-center justify-center gap-2 text-muted rounded-t-sm">
        <Image :size="28" :stroke-width="1.6" />
        <span class="text-[0.75rem]">暂无预览图</span>
      </div>
      <div class="border border-border border-t-0 rounded-b-sm px-3 py-2">
        <div class="text-[0.75rem] text-[#536471] truncate">{{ hostname }}</div>
        <div class="text-[0.9375rem] font-bold leading-snug break-words mt-0.5" :class="isTitlePlaceholder ? 'text-muted' : 'text-text'">{{ titleText }}</div>
        <p class="text-[0.8125rem] text-[#536471] leading-snug m-0 mt-0.5 line-clamp-2 break-words">{{ descText }}</p>
      </div>
    </div>

    <!-- 微信：横向灰底卡片，左缩略图 + 右标题/描述 -->
    <div v-else-if="platform === 'wechat'" class="max-w-[420px]">
      <div class="flex bg-[#f7f7f7] rounded-lg overflow-hidden p-3 gap-3">
        <div class="flex-1 min-w-0 pr-1">
          <div class="text-[0.9375rem] font-semibold leading-snug text-text line-clamp-2 break-words">{{ titleText }}</div>
          <p class="text-[0.8125rem] text-[#888888] leading-snug m-0 mt-1.5 truncate break-words">{{ descText }}</p>
        </div>
        <div class="w-20 h-20 shrink-0 bg-hover overflow-hidden flex items-center justify-center text-muted">
          <img v-if="hasImage" :src="data.imageUrl" :alt="imgAlt" loading="lazy" class="w-full h-full object-cover" @error="onImgError" />
          <Image v-else :size="22" :stroke-width="1.6" />
        </div>
      </div>
    </div>

    <!-- LinkedIn：大图 + 标题 + 描述 + 域名，紧凑 -->
    <div v-else-if="platform === 'linkedin'" class="max-w-[500px]">
      <div v-if="hasImage" class="aspect-[16/9] w-full bg-hover overflow-hidden">
        <img :src="data.imageUrl" :alt="imgAlt" loading="lazy" class="w-full h-full object-cover" @error="onImgError" />
      </div>
      <div v-else class="aspect-[16/9] w-full bg-hover flex flex-col items-center justify-center gap-2 text-muted">
        <Image :size="28" :stroke-width="1.6" />
        <span class="text-[0.75rem]">暂无预览图</span>
      </div>
      <div class="border border-border border-t-0 px-3 py-2">
        <div class="text-[0.75rem] text-[#00000099] truncate">{{ hostname }}</div>
        <div class="text-[0.9375rem] font-semibold leading-snug break-words mt-0.5" :class="isTitlePlaceholder ? 'text-muted' : 'text-text'">{{ titleText }}</div>
        <p class="text-[0.8125rem] text-[#00000099] leading-snug m-0 mt-0.5 line-clamp-2 break-words">{{ descText }}</p>
      </div>
    </div>

    <!-- Telegram instant view：站点名 + 标题（品牌蓝）+ 描述 + 图 -->
    <div v-else-if="platform === 'telegram'" class="max-w-[460px]">
      <div class="border border-[#dfe3e8] rounded-lg overflow-hidden bg-card">
        <div class="px-3 pt-2.5">
          <div class="text-[0.75rem] font-bold text-[#38a1db] truncate">{{ siteText }}</div>
          <div class="text-[0.9375rem] font-semibold text-[#38a1db] leading-snug break-words mt-1">{{ titleText }}</div>
          <p class="text-[0.8125rem] text-[#707579] leading-snug m-0 mt-1 break-words line-clamp-2">{{ descText }}</p>
        </div>
        <div v-if="hasImage" class="aspect-[16/9] w-full bg-hover overflow-hidden mt-2.5">
          <img :src="data.imageUrl" :alt="imgAlt" loading="lazy" class="w-full h-full object-cover" @error="onImgError" />
        </div>
        <div v-else class="h-32 w-full bg-hover flex flex-col items-center justify-center gap-2 text-muted mt-2.5">
          <Image :size="28" :stroke-width="1.6" />
          <span class="text-[0.75rem]">暂无预览图</span>
        </div>
      </div>
    </div>

    <!-- Slack unfurl：标题（品牌色链接）+ 描述 + 图 + 底部域名 -->
    <div v-else-if="platform === 'slack'" class="max-w-[460px]">
      <div class="border-l-4 border-[#1d9bd1] pl-3 py-1">
        <div class="text-[0.9375rem] font-bold text-[#1d9bd1] leading-snug break-words">{{ titleText }}</div>
        <p class="text-[0.8125rem] text-[#1d1c1d] leading-snug m-0 mt-1 break-words line-clamp-2">{{ descText }}</p>
        <div v-if="hasImage" class="mt-2 max-h-50 overflow-hidden rounded-sm bg-hover">
          <img :src="data.imageUrl" :alt="imgAlt" loading="lazy" class="w-full h-full object-cover" @error="onImgError" />
        </div>
        <div class="text-[0.75rem] text-[#616061] truncate mt-2">{{ hostname }}</div>
      </div>
    </div>
  </div>
</template>
