<script setup lang="ts">
/**
 * Docker Run 命令助手主组件。
 *
 * 组合命令生成器与参数速查表两个区块。
 */
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import RunGenerator from './docker-run-form/RunGenerator.vue';
import FlagReference from './docker-run-form/FlagReference.vue';
</script>

<template>
  <ResponsiveWorkspace mode="vertical">
    <template #input>
      <RunGenerator />

      <div class="mt-10 pt-8 border-t border-border">
        <FlagReference />
      </div>
    </template>
  </ResponsiveWorkspace>
</template>
