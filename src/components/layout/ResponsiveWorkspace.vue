<script setup lang="ts">
/**
 * 响应式布局骨架组件，为工具页面提供统一的输入/输出/操作区域布局。
 *
 * 支持 vertical（垂直堆叠）和 horizontal（左右并排）两种模式。
 * horizontal 模式在屏幕宽度 ≥1920px 时自动切换为 Input | Output 左右双栏布局，
 * 否则降级为垂直堆叠。所有 slot 均为可选，为空时对应区域自动隐藏。
 *
 * @example
 * ```vue
 * <ResponsiveWorkspace mode="horizontal">
 *   <template #input>
 *     <textarea v-model="input" />
 *   </template>
 *   <template #actions>
 *     <button @click="convert">转换</button>
 *   </template>
 *   <template #output>
 *     <pre>{{ result }}</pre>
 *   </template>
 * </ResponsiveWorkspace>
 * ```
 */
interface Props {
  /** 布局模式：vertical 垂直堆叠，horizontal 响应式双栏 */
  mode?: 'vertical' | 'horizontal';
  /** 区域之间的间距 Tailwind class */
  gap?: string;
  /** 输入区域额外的 Tailwind class */
  inputClass?: string;
  /** 输出区域额外的 Tailwind class */
  outputClass?: string;
}

withDefaults(defineProps<Props>(), {
  mode: 'vertical',
  gap: 'gap-6',
  inputClass: '',
  outputClass: '',
});
</script>

<template>
  <div
    :class="[
      'mx-auto w-full transition-all duration-300 ease-in-out',
      mode === 'vertical' ? 'max-w-[720px] flex flex-col' : 'max-w-[1600px] grid grid-cols-1 min-w-[1920px]:grid-cols-2',
      gap,
    ]"
  >
    <!-- Actions 区域：horizontal 模式下横跨两栏 -->
    <div
      v-if="$slots.actions"
      :class="[
        'flex flex-wrap items-center justify-center',
        mode === 'horizontal' && 'min-w-[1920px]:col-span-2',
      ]"
    >
      <slot name="actions" />
    </div>

    <!-- Input 区域 -->
    <div
      v-if="$slots.input"
      :class="[
        'min-w-0',
        inputClass,
      ]"
    >
      <slot name="input" />
    </div>

    <!-- Output 区域 -->
    <div
      v-if="$slots.output"
      :class="[
        'min-w-0',
        outputClass,
      ]"
    >
      <slot name="output" />
    </div>
  </div>
</template>
