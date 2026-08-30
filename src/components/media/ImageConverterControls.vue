<script setup lang="ts">
/**
 * 图片批量转换的全局控件栏。
 *
 * 直接读写传入的响应式 params（格式/质量/尺寸/EXIF 擦除），
 * 作用于整批图片。EXIF 擦除用原生 checkbox，默认开启。
 */
import { computed } from 'vue';
import OptionRadioGroup from '../ui/OptionRadioGroup.vue';
import { OUTPUT_FORMATS, isLossless, type OutputFormat } from '../../utils/media/image-convert';
import type { ConvertParams } from '../../composables/useImageBatch';

const props = defineProps<{
  /** 响应式全局参数（就地修改） */
  params: ConvertParams;
  /** 当前是否已有图片（控制提示文案展示） */
  hasItems: boolean;
}>();

const lossyFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossy'));
const losslessFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossless'));
const qualityDisabled = computed(() => isLossless(props.params.format));
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-4 flex-wrap">
        <OptionRadioGroup v-model="params.format" :options="lossyFormats" label="有损" inline-label />
        <OptionRadioGroup v-model="params.format" :options="losslessFormats" label="无损" inline-label />
      </div>

      <div class="flex items-center gap-2" :class="qualityDisabled ? 'opacity-50' : ''">
        <span class="text-[0.8125rem] text-muted-foreground">质量</span>
        <input
          v-model.number="params.quality"
          type="range" min="10" max="100" step="1" aria-label="质量"
          :disabled="qualityDisabled" class="w-32 accent-accent"
        />
        <span class="text-[0.8125rem] font-mono w-6">{{ qualityDisabled ? '—' : params.quality }}</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted-foreground">尺寸</span>
        <input
          v-model.number="params.scale"
          type="range" min="1" max="100" step="1" aria-label="尺寸"
          class="w-32 accent-accent"
        />
        <span class="text-[0.8125rem] font-mono">{{ params.scale }}%</span>
      </div>

      <label class="flex items-center gap-1.5 text-[0.8125rem] text-foreground cursor-pointer select-none">
        <input v-model="params.eraseExif" type="checkbox" class="cursor-pointer accent-accent" />
        擦除隐私元数据
      </label>
    </div>

    <div class="min-h-5 text-[0.8125rem] text-muted-foreground">
      <p v-if="hasItems && params.format === 'jpeg'" class="m-0">JPEG 不支持透明背景，透明区域将填充白色</p>
    </div>
  </div>
</template>
