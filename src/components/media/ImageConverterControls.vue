<script setup lang="ts">
/**
 * 图片批量转换的全局控件栏。
 *
 * 直接读写传入的响应式 params（格式/质量/尺寸/EXIF 擦除/ICO 设置），
 * 作用于整批图片。EXIF 擦除用原生 checkbox，默认开启。
 */
import { computed } from 'vue';
import OptionRadioGroup from '../ui/OptionRadioGroup.vue';
import SelectListbox from '../ui/SelectListbox.vue';
import { OUTPUT_FORMATS, isLossless, type OutputFormat } from '../../utils/media/image-convert';
import {
  ICO_SIZE_OPTIONS,
  DEFAULT_ICO_SIZE,
  type IcoFit,
  type IcoAnchor,
} from '../../utils/media/encoders/ico';
import type { ConvertParams } from '../../composables/useImageBatch';

const props = defineProps<{
  /** 响应式全局参数（就地修改） */
  params: ConvertParams;
  /** 当前是否已有图片（控制提示文案展示） */
  hasItems: boolean;
}>();

const lossyFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossy'));
const losslessFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossless'));
const isIco = computed(() => props.params.format === 'ico');
const qualityDisabled = computed(() => isLossless(props.params.format));

const icoFitOptions: { value: IcoFit; label: string }[] = [
  { value: 'cover', label: '裁切填满' },
  { value: 'contain', label: '留白完整' },
];
const icoAnchorOptions: { value: IcoAnchor; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'middle-left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'middle-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' },
];

/** ICO 尺寸单选选项 */
const icoSizeOptions = computed(() =>
  ICO_SIZE_OPTIONS.map((s) => ({ value: s, label: String(s) })),
);

/** ICO 尺寸单选值（桥接底层 icoSizes 数组的首元素） */
const icoSize = computed<number>({
  get: () => props.params.icoSizes[0] ?? DEFAULT_ICO_SIZE,
  set: (v) => {
    props.params.icoSizes = [v];
  },
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-4 flex-wrap">
        <OptionRadioGroup v-model="params.format" :options="lossyFormats" label="有损" inline-label />
        <OptionRadioGroup v-model="params.format" :options="losslessFormats" label="无损" inline-label />
      </div>

      <template v-if="!isIco">
        <div class="flex items-center gap-2" :class="qualityDisabled ? 'opacity-50' : ''">
          <span class="text-[0.8125rem] text-muted">质量</span>
          <input
            v-model.number="params.quality"
            type="range" min="10" max="100" step="1" aria-label="质量"
            :disabled="qualityDisabled" class="w-32 accent-accent"
          />
          <span class="text-[0.8125rem] font-mono w-6">{{ qualityDisabled ? '—' : params.quality }}</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-[0.8125rem] text-muted">尺寸</span>
          <input
            v-model.number="params.scale"
            type="range" min="1" max="100" step="1" aria-label="尺寸"
            class="w-32 accent-accent"
          />
          <span class="text-[0.8125rem] font-mono">{{ params.scale }}%</span>
        </div>
      </template>

      <label class="flex items-center gap-1.5 text-[0.8125rem] text-text cursor-pointer select-none">
        <input v-model="params.eraseExif" type="checkbox" class="cursor-pointer accent-accent" />
        擦除隐私元数据
      </label>
    </div>

    <!-- ICO 专属设置 -->
    <div v-if="isIco" class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <OptionRadioGroup v-model="icoSize" :options="icoSizeOptions" label="尺寸" inline-label />
      <OptionRadioGroup v-model="params.icoFit" :options="icoFitOptions" label="适配" inline-label />
      <div v-if="params.icoFit === 'cover'" class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted">锚点</span>
        <SelectListbox
          class="w-28" :model-value="params.icoAnchor" :options="icoAnchorOptions"
          @update:model-value="(v) => (params.icoAnchor = v as IcoAnchor)"
        />
      </div>
    </div>

    <div class="min-h-5 text-[0.8125rem] text-muted">
      <p v-if="isIco" class="m-0">ICO 按所选尺寸封装；非正方形图按所选适配方式处理</p>
      <p v-else-if="hasItems && params.format === 'jpeg'" class="m-0">JPEG 不支持透明背景，透明区域将填充白色</p>
    </div>
  </div>
</template>
