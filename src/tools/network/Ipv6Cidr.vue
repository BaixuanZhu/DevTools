<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';

import { calculateSubnetV6, type SubnetInfoV6 } from '../../utils/network/cidr-v6';

/** CIDR 输入值（默认示例，RFC 3849 文档前缀） */
const cidrInput = ref('2001:db8::/32');
/** 错误信息 */
const errorMsg = ref('');
/** 子网计算结果（根据默认值预计算） */
const subnetInfo = ref<SubnetInfoV6 | null>(calculateSubnetV6('2001:db8::/32'));

/** IPv6 前缀长度参考表 */
const prefixReference = [
  { prefix: 128, usage: '单主机', total: '1' },
  { prefix: 127, usage: '点对点链路（RFC 6164）', total: '2' },
  { prefix: 120, usage: '小型子网', total: '2⁸' },
  { prefix: 112, usage: '—', total: '2¹⁶' },
  { prefix: 96, usage: '—', total: '2³²' },
  { prefix: 64, usage: '标准终端子网', total: '2⁶⁴' },
  { prefix: 56, usage: '家庭 / 小站点分配', total: '2⁷²' },
  { prefix: 48, usage: '站点分配（RFC 推荐最小）', total: '2⁸⁰' },
  { prefix: 32, usage: 'ISP 端分配', total: '2⁹⁶' },
  { prefix: 0, usage: '全部', total: '2¹²⁸' },
];

/** 清空所有状态 */
function handleClear() {
  cidrInput.value = '';
  errorMsg.value = '';
  subnetInfo.value = null;
}

// 实时计算：监听输入变化
watch(cidrInput, (val) => {
  const trimmed = val.trim();
  if (!trimmed) {
    errorMsg.value = '';
    subnetInfo.value = null;
    return;
  }
  try {
    subnetInfo.value = calculateSubnetV6(trimmed);
    errorMsg.value = '';
  } catch (e) {
    subnetInfo.value = null;
    errorMsg.value = e instanceof Error ? e.message : '计算出错';
  }
});
</script>

<template>
  <div class="w-full max-w-3xl">
    <ToolHeader
      title="IPv6 子网计算器"
      description="输入 IPv6 地址和前缀长度，计算网络地址、地址范围、地址类型等信息"
      :show-example="false"
    />

    <!-- IPv6 CIDR 术语说明 -->
    <div class="mb-5 px-4 py-3 border border-border rounded-sm bg-card text-[0.8125rem] text-muted leading-relaxed">
      <p class="m-0 mb-2">
        <strong class="text-text">IPv6 CIDR</strong> 用
        <code class="px-1 py-0.5 bg-surface rounded-sm font-mono text-[0.75rem] text-accent">地址 / 前缀长度</code>
        表示子网，前缀长度范围 0–128。与 IPv4 不同，IPv6 没有广播地址，地址空间极大（/64 子网就有约 1.8×10¹⁹ 个地址）。
      </p>
      <p class="m-0">
        例如 <code class="px-1 py-0.5 bg-surface rounded-sm font-mono text-[0.75rem] text-accent">2001:db8::/32</code>
        表示前 32 位为网络前缀。IPv6 地址有压缩（<code class="font-mono">::</code> 省略连续零段）与展开（8 组 4 位十六进制）两种格式，本工具同时展示。
      </p>
    </div>

    <!-- 输入区域 -->
    <div class="flex items-start gap-3 mb-3">
      <div class="flex-1">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">IPv6 CIDR 地址</label>
        <input
          v-model="cidrInput"
          type="text"
          placeholder="输入 IPv6 CIDR，如 2001:db8::/32"
          class="w-full px-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 placeholder:font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
      <ClearButton @clear="handleClear" class="mt-6" />
    </div>

    <!-- 错误信息 -->
    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

    <!-- 计算结果 -->
    <div v-if="subnetInfo" class="flex flex-col gap-4">
      <!-- 主要信息网格 -->
      <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">网络地址（压缩）</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.networkAddressCompressed }}</span>
            <CopyButton :text="subnetInfo.networkAddressCompressed" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">网络地址（展开）</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.networkAddressExpanded }}</span>
            <CopyButton :text="subnetInfo.networkAddressExpanded" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">前缀长度</span>
          <span class="text-sm text-text font-mono">/{{ subnetInfo.prefix }}</span>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">地址总数</span>
          <span class="text-sm text-text font-mono break-all">{{ subnetInfo.totalAddresses }}</span>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">范围首地址</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.firstAddressCompressed }}</span>
            <CopyButton :text="subnetInfo.firstAddressCompressed" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">范围末地址</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.lastAddressCompressed }}</span>
            <CopyButton :text="subnetInfo.lastAddressCompressed" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card col-span-2 max-sm:col-span-1">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">地址类型</span>
          <span class="text-sm text-text">
            <strong>{{ subnetInfo.type.label }}</strong>
            <span class="text-muted"> · {{ subnetInfo.type.description }}</span>
          </span>
        </div>
      </div>

      <!-- IPv6 前缀长度参考 -->
      <div class="border-t border-border pt-4">
        <h3 class="text-[0.8125rem] text-muted font-medium">IPv6 前缀长度参考</h3>
        <div class="pt-2">
          <div class="overflow-x-auto">
            <table class="w-full text-[0.8125rem]">
              <thead>
                <tr class="border-b border-border text-left">
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">前缀</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">典型用途</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide text-right">地址数</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in prefixReference"
                  :key="row.prefix"
                  :class="[
                    'border-b border-border last:border-b-0 transition-[background-color] duration-150',
                    row.prefix === subnetInfo.prefix ? 'bg-accent/5' : 'hover:bg-hover',
                  ]"
                >
                  <td class="px-3 py-1.5 font-mono font-semibold text-accent">/{{ row.prefix }}</td>
                  <td class="px-3 py-1.5 text-text">{{ row.usage }}</td>
                  <td class="px-3 py-1.5 text-right font-mono text-text">{{ row.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
