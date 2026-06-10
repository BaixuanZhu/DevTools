<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';

import { calculateSubnet, type SubnetInfo } from '../../utils/network/cidr';
import { prefixToMask, formatIPv4 } from '../../utils/network/ipv4';

/** CIDR 输入值（默认示例） */
const cidrInput = ref('192.168.1.0/24');
/** 错误信息 */
const errorMsg = ref('');
/** 子网计算结果（根据默认值预计算） */
const subnetInfo = ref<SubnetInfo | null>(calculateSubnet('192.168.1.0/24'));

/**
 * 格式化大数字显示（添加千分位分隔符）
 */
function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/** CIDR 前缀长度参考表（关键前缀值） */
const prefixReference = [
  { prefix: 32, mask: '255.255.255.255', hosts: 1, total: 1 },
  { prefix: 31, mask: '255.255.255.254', hosts: 2, total: 2 },
  { prefix: 30, mask: '255.255.255.252', hosts: 2, total: 4 },
  { prefix: 29, mask: '255.255.255.248', hosts: 6, total: 8 },
  { prefix: 28, mask: '255.255.255.240', hosts: 14, total: 16 },
  { prefix: 27, mask: '255.255.255.224', hosts: 30, total: 32 },
  { prefix: 26, mask: '255.255.255.192', hosts: 62, total: 64 },
  { prefix: 25, mask: '255.255.255.128', hosts: 126, total: 128 },
  { prefix: 24, mask: '255.255.255.0', hosts: 254, total: 256 },
  { prefix: 23, mask: '255.255.254.0', hosts: 510, total: 512 },
  { prefix: 22, mask: '255.255.252.0', hosts: 1022, total: 1024 },
  { prefix: 20, mask: '255.255.240.0', hosts: 4094, total: 4096 },
  { prefix: 16, mask: '255.255.0.0', hosts: 65534, total: 65536 },
  { prefix: 12, mask: '255.240.0.0', hosts: 1048574, total: 1048576 },
  { prefix: 8, mask: '255.0.0.0', hosts: 16777214, total: 16777216 },
  { prefix: 0, mask: '0.0.0.0', hosts: 4294967294, total: 4294967296 },
];

/**
 * 清空所有状态
 */
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
    subnetInfo.value = calculateSubnet(trimmed);
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
      title="IPv4 子网计算器"
      description="输入 IP 地址和子网掩码，计算网络地址、广播地址、可用主机数等子网信息"
      :show-example="false"
    />

    <!-- CIDR 术语说明 -->
    <div class="mb-5 px-4 py-3 border border-border rounded-sm bg-card text-[0.8125rem] text-muted leading-relaxed">
      <p class="m-0 mb-2">
        <strong class="text-text">CIDR</strong>（Classless Inter-Domain Routing，无类别域间路由）是一种用
        <code class="px-1 py-0.5 bg-surface rounded-sm font-mono text-[0.75rem] text-accent">IP地址/前缀长度</code>
        表示子网的方式。前缀长度表示网络位有多少位，剩余的则是主机位。
      </p>
      <p class="m-0">
        例如 <code class="px-1 py-0.5 bg-surface rounded-sm font-mono text-[0.75rem] text-accent">192.168.1.0/24</code>
        表示前 24 位是网络地址（对应子网掩码 255.255.255.0），剩余 8 位用于主机寻址，可用主机数为 254。
        前缀越小子网越大：/16 可容纳 65534 台主机，/28 仅 14 台。
      </p>
    </div>

    <!-- 输入区域 -->
    <div class="flex items-start gap-3 mb-3">
      <div class="flex-1">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">CIDR 地址</label>
        <input
          v-model="cidrInput"
          type="text"
          placeholder="输入 CIDR 地址，如 192.168.1.0/24"
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
        <!-- 网络地址 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">网络地址</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.networkAddress }}</span>
            <CopyButton :text="subnetInfo.networkAddress" />
          </div>
        </div>

        <!-- 广播地址 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">广播地址</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.broadcastAddress }}</span>
            <CopyButton :text="subnetInfo.broadcastAddress" />
          </div>
        </div>

        <!-- 子网掩码 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">子网掩码</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.subnetMask }}</span>
            <CopyButton :text="subnetInfo.subnetMask" />
          </div>
        </div>

        <!-- 通配符掩码 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">通配符掩码</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.wildcardMask }}</span>
            <CopyButton :text="subnetInfo.wildcardMask" />
          </div>
        </div>

        <!-- 第一个可用主机 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">第一个可用主机</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.firstHost }}</span>
            <CopyButton :text="subnetInfo.firstHost" />
          </div>
        </div>

        <!-- 最后一个可用主机 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">最后一个可用主机</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.lastHost }}</span>
            <CopyButton :text="subnetInfo.lastHost" />
          </div>
        </div>

        <!-- 可用主机数 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">可用主机数</span>
          <span class="text-sm text-text font-mono">{{ formatNumber(subnetInfo.usableHosts) }}</span>
        </div>

        <!-- IP 范围 -->
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">IP 范围</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono">{{ subnetInfo.ipRange }}</span>
            <CopyButton :text="subnetInfo.ipRange" />
          </div>
        </div>
      </div>

      <!-- 二进制表示 -->
      <div class="border-t border-border pt-4">
        <h3 class="text-[0.8125rem] text-muted font-medium">二进制表示</h3>
        <div class="pt-2">
          <div class="grid grid-cols-1 gap-2">
            <div class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">网络地址</span>
              <code class="text-xs text-text font-mono break-all">{{ subnetInfo.networkBinary }}</code>
            </div>
            <div class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">子网掩码</span>
              <code class="text-xs text-text font-mono break-all">{{ subnetInfo.maskBinary }}</code>
            </div>
            <div class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">通配符掩码</span>
              <code class="text-xs text-text font-mono break-all">{{ subnetInfo.wildcardBinary }}</code>
            </div>
            <div class="flex flex-col gap-1 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">广播地址</span>
              <code class="text-xs text-text font-mono break-all">{{ subnetInfo.broadcastBinary }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- CIDR 前缀长度参考 -->
      <div class="border-t border-border pt-4">
        <h3 class="text-[0.8125rem] text-muted font-medium">CIDR 前缀长度参考</h3>
        <div class="pt-2">
          <div class="overflow-x-auto">
            <table class="w-full text-[0.8125rem]">
              <thead>
                <tr class="border-b border-border text-left">
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">前缀</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">子网掩码</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide text-right">可用主机</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide text-right">总 IP 数</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in prefixReference"
                  :key="row.prefix"
                  :class="[
                    'border-b border-border last:border-b-0 transition-[background-color] duration-150',
                    subnetInfo && row.prefix === subnetInfo.prefix
                      ? 'bg-accent/5'
                      : 'hover:bg-hover',
                  ]"
                >
                  <td class="px-3 py-1.5 font-mono font-semibold text-accent">/{{ row.prefix }}</td>
                  <td class="px-3 py-1.5 font-mono text-text">{{ row.mask }}</td>
                  <td class="px-3 py-1.5 text-right font-mono text-text">{{ formatNumber(row.hosts) }}</td>
                  <td class="px-3 py-1.5 text-right font-mono text-text">{{ formatNumber(row.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
