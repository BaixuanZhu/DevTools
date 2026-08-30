<script setup lang="ts">
/**
 * PostgreSQL 配置生成器（工具页主组件）。
 *
 * 持有 GenerateContext（reactive），computed 驱动 generatePgConf 渲染；
 * 移动端纵向排列：快速配置 → 产物区（预览/OS 建议/免责）→ 分组参数单卡清单；
 * 桌面双栏 grid：左列 = 快速配置 + 分组清单，右列产物区跨行 sticky。
 * 分组全部默认收起（推荐值打开即可用，展开仅为微调）。状态不进全局 store，
 * 刷新即重置（配置生成器无持久化必要）。
 *
 * 与 MySQL 版的差异：无 onMounted 随机种子（PG 无 server_id/requirepass 类
 * 实例唯一标识）；无废弃提示行（16–18 窗口内无弃用参数，isAvailable 恒真除
 * 18 独有组）；复制组仅主从态渲染、异步 IO 组仅 v18 渲染。
 */
import { computed, reactive } from 'vue';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ControlPanel from './postgres-config/components/ControlPanel.vue';
import ParamRow from '../../components/config/ParamRow.vue';
import ConfigPreview from '../../components/config/ConfigPreview.vue';
import AdvicePanel from './postgres-config/components/AdvicePanel.vue';
import {
  CONFIG_PARAMS,
  PARAM_GROUPS,
  createDefaultContext,
  type GenerateContext,
  type PgParam,
  type ParamValue,
} from './postgres-config/params';
import { generatePgConf, resolveValue, serializeConf } from './postgres-config/generate';
import { isAvailable } from './postgres-config/version';
import { buildOsAdvice, buildReplicationHint } from './postgres-config/advice';
import { downloadTextFile } from '../../utils/shared/download';
import { toastStore } from '../../stores/toast';

/** 生成上下文（默认画像：4GB / 4 核 / SSD / 通用 OLTP / 并发 200 / 单机 / 仅本机 / 5432 / v17） */
const ctx = reactive<GenerateContext>(createDefaultContext());

/** 生成的 conf 行数组（预览、复制、下载共用） */
const lines = computed(() => generatePgConf(CONFIG_PARAMS, ctx));

/** 分组后的可见参数：复制组仅主从态、异步 IO 组仅 v18，其余 7 组恒显；
 * 组内条目统一走引擎 isAvailable 过滤（注册表条目均带 compute 或 defaultValue，
 * 不存在"上下文不适用"的隐藏场景，无需再做 null 值过滤） */
const groups = computed(() =>
  PARAM_GROUPS.map((group) => ({
    ...group,
    params: CONFIG_PARAMS.filter((p) => {
      if (p.group !== group.id) return false;
      if (group.id === 'replication' && ctx.mode !== 'replica') return false;
      if (group.id === 'async-io' && ctx.version !== '18') return false;
      return isAvailable(p, ctx.version);
    }),
  })).filter((g) => g.params.length > 0),
);

/** 参数当前生效值。不能命名为 valueOf——SSR 非内联渲染下该名字会解析到 Object.prototype.valueOf 而非 setup 绑定 */
function currentValueOf(param: PgParam): ParamValue | null {
  return resolveValue(param, ctx);
}

/** 参数推荐值（compute 结果，供下拉"推荐"标记） */
function recommendedOf(param: PgParam): ParamValue | null {
  return param.compute ? param.compute(ctx) : param.defaultValue ?? null;
}

/**
 * 面板渲染用的参数定义：listen_addresses 内网监听时 compute 返回的绑定 IP
 * 不在静态选项内，SelectListbox 触发器会显示空白——动态追加当前值为临时选项
 * （reka SelectItem 禁止空串 value，绑定 IP 未填时值必为空串，不加选项）。
 * @param param - 注册表参数定义
 * @returns 原定义或追加了当前值选项的副本（其余参数原样返回）
 */
function paramFor(param: PgParam): PgParam {
  if (param.key !== 'listen_addresses') return param;
  const value = currentValueOf(param);
  const options = param.options ?? [];
  if (typeof value !== 'string' || !value || options.some((o) => o.value === value)) {
    return param;
  }
  return { ...param, options: [...options, { value, label: `${value} — 当前绑定 IP（快速配置驱动）` }] };
}

/** 写入用户覆盖值 */
function updateParam(param: PgParam, value: ParamValue): void {
  ctx.overrides[param.key] = value;
}

/** 恢复单个参数为推荐值 */
function resetParam(param: PgParam): void {
  delete ctx.overrides[param.key];
}

/** 清空全部覆盖值，恢复推荐值；画像字段保留（改画像只重算推荐值，不清覆盖，与 MySQL 版联动语义一致） */
function resetAll(): void {
  for (const key of Object.keys(ctx.overrides)) {
    delete ctx.overrides[key];
  }
  toastStore.success('已恢复全部推荐值');
}

/** 下载 postgresql.conf（纯浏览器端 Blob） */
function handleDownload(): void {
  downloadTextFile('postgresql.conf', serializeConf(lines.value), 'text/plain;charset=utf-8');
  toastStore.success('已开始下载 postgresql.conf');
}

/** OS 层建议（官方背书 / 社区惯例两分区，大页条目按当前画像联动） */
const osAdviceSections = computed(() => buildOsAdvice(ctx));

/** 备库要点提示（仅主从模式出现） */
const replicationHint = computed(() => (ctx.mode === 'replica' ? buildReplicationHint(ctx) : null));
</script>

<template>
  <div class="w-full">
    <ToolHeader
      title="PostgreSQL 配置生成器"
      description="按硬件画像与使用场景生成带版本标注的 postgresql.conf，支持 16/17/18 版本联动与单机/主从"
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
          label="postgresql.conf"
          :copy-text="serializeConf(lines)"
          @download="handleDownload"
          @reset="resetAll"
        />

        <AdvicePanel :sections="osAdviceSections" :replication-hint="replicationHint" />
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
                  :param="paramFor(param)"
                  :value="currentValueOf(param)"
                  :recommended="recommendedOf(param)"
                  :version="ctx.version"
                  baseline-version="16"
                  product-label="PostgreSQL"
                  :has-override="ctx.overrides[param.key] !== undefined"
                  @update="(v) => updateParam(param, v)"
                  @reset="resetParam(param)"
                />
              </div>
            </CollapsibleContent>
          </CollapsibleRoot>
        </div>
      </section>
    </div>
  </div>
</template>
