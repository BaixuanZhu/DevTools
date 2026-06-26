<script setup lang="ts">
/**
 * 转盘抽奖工具组件（占位骨架，后续任务填充交互）。
 */
import ToolHeader from '../../components/layout/ToolHeader.vue';
</script>

<template>
  <div>
    <ToolHeader
      title="转盘抽奖"
      description="自定义选项，旋转转盘随机抽取，支持权重、不重复抽取与配置分享"
      :show-example="false"
    />
    <p class="text-sm text-muted">转盘建设中…</p>
  </div>
</template>
