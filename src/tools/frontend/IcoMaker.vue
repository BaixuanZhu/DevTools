<script setup lang="ts">
/**
 * ICO 图标制作工具页（创作形态）。
 *
 * 双模式 Tab：「制作 ICO」（IcoMakerPanel 创作三段式）/「解析 ICO」（IcoParsePanel
 * 条目提取）。两个面板常挂（ModeTabGroup force-mount），各自持有状态并在自身
 * onUnmounted 中统一释放 object URL 与 ImageBitmap；本组件只负责模式切换与页面骨架。
 */
import { ref } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import IcoMakerPanel from '../../components/media/IcoMakerPanel.vue';
import IcoParsePanel from '../../components/media/IcoParsePanel.vue';

/** 当前激活模式 key（make=制作 / parse=解析） */
const mode = ref('make');
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="ICO 图标制作"
      description="导入图片裁切创作多尺寸 ICO favicon，支持解析 ICO 提取内嵌 PNG，纯浏览器端本地处理"
      :show-example="false"
    />

    <ModeTabGroup
      v-model="mode"
      :options="[
        { key: 'make', label: '制作 ICO' },
        { key: 'parse', label: '解析 ICO' },
      ]"
    >
      <template #make>
        <IcoMakerPanel />
      </template>
      <template #parse>
        <IcoParsePanel />
      </template>
    </ModeTabGroup>
  </div>
</template>
