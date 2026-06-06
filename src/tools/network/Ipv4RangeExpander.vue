<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { ipRangeToCIDRs, type RangeResult } from '../../utils/network/ip-range';
import { isValidIPv4, prefixToMask, formatIPv4 } from '../../utils/network/ipv4';

/** 起始 IP 输入（默认示例） */
const startIP = ref('192.168.0.0');
/** 结束 IP 输入（默认示例） */
const endIP = ref('192.168.1.255');
/** 错误信息 */
const errorMsg = ref('');
/** 计算结果（根据默认值预计算） */
const rangeResult = ref<RangeResult | null>(ipRangeToCIDRs('192.168.0.0', '192.168.1.255'));

/**
 * 格式化大数字显示
 */
function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/** 用于复制全部 CIDR 的文本 */
const allCidrsText = computed(() => {
  if (!rangeResult.value) return '';
  return rangeResult.value.cidrs.map((c) => c.cidr).join('\n');
});

/**
 * 清空所有状态
 */
function handleClear() {
  startIP.value = '';
  endIP.value = '';
  errorMsg.value = '';
  rangeResult.value = null;
}

/**
 * 尝试计算结果
 */
function tryCalculate() {
  const s = startIP.value.trim();
  const e = endIP.value.trim();

  if (!s && !e) {
    errorMsg.value = '';
    rangeResult.value = null;
    return;
  }

  // 部分填写时提示
  if (!s || !e) {
    errorMsg.value = '请输入起始和结束 IP 地址';
    rangeResult.value = null;
    return;
  }

  // 格式预检
  if (!isValidIPv4(s)) {
    errorMsg.value = '起始 IP 地址格式无效';
    rangeResult.value = null;
    return;
  }
  if (!isValidIPv4(e)) {
    errorMsg.value = '结束 IP 地址格式无效';
    rangeResult.value = null;
    return;
  }

  try {
    rangeResult.value = ipRangeToCIDRs(s, e);
    errorMsg.value = '';
  } catch (err) {
    rangeResult.value = null;
    errorMsg.value = err instanceof Error ? err.message : '计算出错';
  }
}

// 实时计算：监听两个输入
watch([startIP, endIP], () => {
  tryCalculate();
});
</script>

<template>
  <div class="w-full max-w-3xl">
    <ToolHeader
      title="IPv4 范围展开"
      description="给定起始和结束 IPv4 地址，计算覆盖该范围的最简 CIDR 列表"
      :show-example="false"
    />

    <!-- 输入区域 -->
    <div class="grid grid-cols-2 gap-3 mb-3 max-sm:grid-cols-1">
      <div>
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">起始 IP 地址</label>
        <input
          v-model="startIP"
          type="text"
          placeholder="如 192.168.0.0"
          class="w-full px-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 placeholder:font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
      <div>
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">结束 IP 地址</label>
        <input
          v-model="endIP"
          type="text"
          placeholder="如 192.168.1.255"
          class="w-full px-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 placeholder:font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex items-center gap-3 mb-3">
      <ClearButton @clear="handleClear" />
    </div>

    <!-- 错误信息 -->
    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

    <!-- 计算结果 -->
    <div v-if="rangeResult" class="flex flex-col gap-4">
      <!-- 摘要卡片 -->
      <div class="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">起始 IP</span>
          <span class="text-sm text-text font-mono">{{ rangeResult.startIP }}</span>
        </div>
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">结束 IP</span>
          <span class="text-sm text-text font-mono">{{ rangeResult.endIP }}</span>
        </div>
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">IP 总数</span>
          <span class="text-sm text-text font-mono">{{ formatNumber(rangeResult.totalIPs) }}</span>
        </div>
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">CIDR 块数</span>
          <span class="text-sm text-text font-mono">{{ rangeResult.cidrs.length }}</span>
        </div>
      </div>

      <!-- CIDR 列表 -->
      <div class="border border-border rounded-md bg-card">
        <!-- 列表头 -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border">
          <span class="text-[0.8125rem] font-semibold text-text">CIDR 块列表</span>
          <CopyButton :text="allCidrsText" label="复制全部" />
        </div>

        <!-- 列表表头 -->
        <div class="grid grid-cols-[28px_1fr_1fr_auto_auto] items-center gap-4 px-4 py-1.5 border-b border-border bg-surface">
          <span class="text-[0.6875rem] font-semibold text-muted">#</span>
          <span class="text-[0.6875rem] font-semibold text-muted">CIDR 表示法</span>
          <span class="text-[0.6875rem] font-semibold text-muted">子网掩码</span>
          <span class="text-[0.6875rem] font-semibold text-muted text-right">IP 数量</span>
          <span class="min-w-[48px]"></span>
        </div>

        <!-- 列表内容 -->
        <div class="max-h-[400px] overflow-y-auto">
          <div
            v-for="(block, index) in rangeResult.cidrs"
            :key="index"
            class="grid grid-cols-[28px_1fr_1fr_auto_auto] items-center gap-4 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-hover transition-[background-color] duration-150"
          >
            <!-- 序号 -->
            <span class="text-xs text-muted text-right">{{ index + 1 }}</span>

            <!-- CIDR 表示法 -->
            <code class="text-[0.8125rem] text-text font-mono font-semibold">{{ block.cidr }}</code>

            <!-- 子网掩码 -->
            <code class="text-[0.8125rem] text-muted font-mono">{{ formatIPv4(prefixToMask(block.prefix)) }}</code>

            <!-- 主机数 -->
            <span class="text-[0.8125rem] text-muted text-right">{{ formatNumber(block.hostCount) }} 个 IP</span>

            <!-- 复制单个 -->
            <CopyButton :text="block.cidr" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
