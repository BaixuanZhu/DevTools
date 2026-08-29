<script setup lang="ts">
/**
 * Redis 配置生成器（工具页主组件）。
 *
 * 持有 GenerateContext（reactive），computed 驱动 generateConf 渲染；
 * 移动端纵向排列：快速配置 → 产物区（预览/系统建议/免责）→ 分组参数单卡清单；
 * 桌面双栏 grid：左列 = 快速配置 + 分组清单，右列产物区跨行 sticky。
 * 分组全部默认收起（推荐值打开即可用，展开仅为微调）。状态不进全局 store，
 * 刷新即重置（配置生成器无持久化必要）。
 */
import { computed, onMounted, reactive } from 'vue';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ControlPanel from './redis-config/components/ControlPanel.vue';
import ParamRow from '../../components/config/ParamRow.vue';
import ConfigPreview from '../../components/config/ConfigPreview.vue';
import SysctlPanel from './redis-config/components/SysctlPanel.vue';
import {
  CONFIG_PARAMS,
  PARAM_GROUPS,
  createDefaultContext,
  type ConfigParam,
  type GenerateContext,
  type ParamValue,
} from './redis-config/params';
import {
  findDirectiveValues,
  generateConf,
  resolveValue,
  serializeConf,
} from './redis-config/generate';
import { generatePassword } from './redis-config/secret';
import { isAvailable, isDeprecatedAt, showsDeprecationNotice } from './redis-config/version';
import { buildSysctlSuggestions } from './redis-config/sysctl';
import { downloadTextFile } from '../../utils/shared/download';
import { toastStore } from '../../stores/toast';

/** 生成上下文（默认画像：2 核 / 4GB / SSD / 缓存 / RDB+AOF 混合 / 7.4 / 并发 500 / 单机） */
const ctx = reactive<GenerateContext>(createDefaultContext());

/** 打开页面即本地生成一次 requirepass（island 服务端渲染时 setup 也会执行，随机值须推迟到挂载后，避免 SSR/水合不匹配） */
onMounted(() => {
  if (ctx.overrides['requirepass'] === undefined) {
    ctx.overrides['requirepass'] = generatePassword();
  }
});

/** 生成的 conf 行数组（预览、复制、下载共用） */
const lines = computed(() => generateConf(ctx));

/** 分组后的可见参数：含废弃提示行；上下文不适用（compute null 且无覆盖）的整行隐藏 */
const groups = computed(() =>
  PARAM_GROUPS.map((group) => ({
    ...group,
    params: CONFIG_PARAMS.filter((p) => {
      if (p.group !== group.id) return false;
      const visible =
        isAvailable(p, ctx.version) ||
        (showsDeprecationNotice(p) && isDeprecatedAt(p, ctx.version));
      if (!visible) return false;
      return p.compute(ctx) !== null || ctx.overrides[p.key] !== undefined;
    }),
  })).filter((g) => g.params.length > 0),
);

/** 参数当前生效值。不能命名为 valueOf——SSR 非内联渲染下该名字会解析到 Object.prototype.valueOf 而非 setup 绑定 */
function currentValueOf(param: ConfigParam): ParamValue | null {
  return resolveValue(param, ctx);
}

/** 参数推荐值（compute 结果，供下拉"推荐"标记） */
function recommendedOf(param: ConfigParam): ParamValue | null {
  return param.compute(ctx);
}

/** 是否渲染为废弃提示行 */
function deprecatedOf(param: ConfigParam): boolean {
  return (
    !isAvailable(param, ctx.version) &&
    showsDeprecationNotice(param) &&
    isDeprecatedAt(param, ctx.version)
  );
}

/** 写入用户覆盖值 */
function updateParam(param: ConfigParam, value: ParamValue): void {
  ctx.overrides[param.key] = value;
}

/** 恢复单个参数为推荐值 */
function resetParam(param: ConfigParam): void {
  delete ctx.overrides[param.key];
}

/** 清空全部覆盖值，恢复推荐值；requirepass 重新生成一次，保证重置后的 conf 仍可直接使用 */
function resetAll(): void {
  for (const key of Object.keys(ctx.overrides)) {
    delete ctx.overrides[key];
  }
  ctx.overrides['requirepass'] = generatePassword();
  toastStore.success('已恢复全部推荐值');
}

/** 下载 redis.conf（纯浏览器端 Blob） */
function handleDownload(): void {
  downloadTextFile('redis.conf', serializeConf(lines.value), 'text/plain;charset=utf-8');
  toastStore.success('已开始下载 redis.conf');
}

/** 系统参数建议（从生成的 conf 提取联动值） */
const sysctlItems = computed(() => {
  const tcpBacklog = Number(findDirectiveValues(lines.value, 'tcp-backlog')[0]) || 511;
  const maxClients = Number(findDirectiveValues(lines.value, 'maxclients')[0]) || 10000;
  return buildSysctlSuggestions({ tcpBacklog, maxClients });
});
</script>

<template>
  <div class="w-full">
    <ToolHeader
      title="Redis 配置生成器"
      description="按硬件画像与使用场景生成带版本标注的 redis.conf，支持单机/主从与系统参数建议"
      :show-example="false"
    />

    <div
      class="mx-auto flex w-full max-w-400 flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-4 xl:gap-x-8"
    >
      <!-- 快速配置：移动端居首；桌面左栏第 1 行 -->
      <div class="min-w-0">
        <ControlPanel :ctx="ctx" @reset="resetAll" />
      </div>

      <!-- 产物区：移动端紧随快速配置（微调分组之后置，保住"改完即见"的反馈闭环）；桌面右栏跨两行 sticky -->
      <div class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:row-span-2">
        <ConfigPreview
          :lines="lines"
          label="redis.conf"
          :copy-text="serializeConf(lines)"
          @download="handleDownload"
          @reset="resetAll"
        />

        <SysctlPanel :items="sysctlItems" />

        <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">
          免责声明：输出为参考值，需结合 <code class="rounded-sm bg-accent px-1 font-mono text-xs">INFO</code> /
          慢查询 / 监控数据持续调整；所有计算与密码生成均在浏览器本地完成，数据不上传。
        </p>
      </div>

      <!-- 分组参数：合并为单卡行式清单，全部默认收起，按需展开微调 -->
      <section class="min-w-0 rounded-lg border border-border bg-card">
        <div class="divide-y divide-border">
          <CollapsibleRoot v-for="group in groups" :key="group.id" :default-open="group.defaultOpen">
            <CollapsibleTrigger
              class="group flex w-full items-center justify-between px-4 py-2.5 text-left transition-[background-color] duration-150 first:rounded-t-lg last:rounded-b-lg hover:bg-accent"
            >
              <span class="flex items-center gap-2">
                <span class="text-[0.8125rem] font-medium text-foreground">{{ group.label }}</span>
                <span
                  class="inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-[0.6875rem] leading-5 text-muted-foreground tabular-nums"
                >{{ group.params.length }}</span>
              </span>
              <ChevronDown
                class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
                :size="16"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="divide-y divide-border border-t border-border px-4">
                <ParamRow
                  v-for="param in group.params"
                  :key="param.key"
                  :param="param"
                  :value="currentValueOf(param)"
                  :recommended="recommendedOf(param)"
                  :version="ctx.version"
                  baseline-version="pre-7"
                  product-label="Redis"
                  enable-secret
                  :placeholder="param.key === 'replicaof' ? '如 10.0.0.5 6379' : undefined"
                  :has-override="ctx.overrides[param.key] !== undefined"
                  :deprecated="deprecatedOf(param)"
                  @update="(v) => updateParam(param, v)"
                  @reset="resetParam(param)"
                  @generate-secret="updateParam(param, generatePassword())"
                />
              </div>
            </CollapsibleContent>
          </CollapsibleRoot>
        </div>
      </section>
    </div>
  </div>
</template>
