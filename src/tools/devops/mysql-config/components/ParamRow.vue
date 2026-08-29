<script setup lang="ts">
/**
 * 参数行控件（本工具私有）：按参数定义渲染 4 种控件之一，
 * 附参数名、版本徽章、官方文档链接、中文说明与单参重置；
 * 目标版本下已废弃的参数渲染为"废弃提示行"（不渲染控件、不写 conf）。
 *
 * 与 Redis 版的差异：无 multi-select 控件与密码生成按钮；5.7 即引入的参数
 * 不显示徽章（全表都是 5.7+，显示反而成为噪音），仅 8.0/8.4 新名参数标徽章。
 * 内存账单说明由引擎层 comment 静态文案承载（见 params.ts 的
 * max_connections / innodb_buffer_pool_size 注释），不做动态插值。
 */
import { computed } from 'vue';
import type { ConfigParam, ParamValue } from '../params';
import { PARAM_UNITS } from '../params';
import type { MysqlVersion } from '../version';
import SelectListbox from '../../../../components/ui/SelectListbox.vue';
import ToggleSwitch from '../../../../components/ui/ToggleSwitch.vue';
import NumberField from './NumberField.vue';
import type { NumberQuickOption } from './NumberField.vue';

const props = withDefaults(
  defineProps<{
    /** 参数定义 */
    param: ConfigParam;
    /** 当前生效值（override ?? compute；废弃行可为 null） */
    value: ParamValue | null;
    /** 当前上下文的 compute 推荐值（下拉"推荐"标记依据） */
    recommended: ParamValue | null;
    /** 目标版本（版本徽章 title 用） */
    version: MysqlVersion;
    /** 用户是否覆盖了推荐值 */
    hasOverride: boolean;
    /** 是否渲染为废弃提示行 */
    deprecated?: boolean;
  }>(),
  { deprecated: false },
);

const emit = defineEmits<{
  /** 值变更（原始类型，父层写入 overrides） */
  update: [value: ParamValue];
  /** 恢复该参数为推荐值 */
  reset: [];
}>();

/** 8.0+ 引入的参数显示版本徽章（5.7 为全表基线，不标） */
const badge = computed(() => (props.param.introducedIn === '5.7' ? null : props.param.introducedIn));

/** select 选项：给推荐项追加"（推荐）"标记 */
const selectOptions = computed(() =>
  (props.param.options ?? []).map((o) => ({
    value: o.value,
    label:
      typeof props.recommended === 'string' && o.value === props.recommended
        ? `${o.label}（推荐）`
        : o.label,
  })),
);

/** 下拉当前值（string 形态） */
const stringValue = computed(() => (typeof props.value === 'string' ? props.value : ''));

/**
 * 由 range 数值项派生推荐快捷选项：按值去重，同值档位名以 / 合并
 * （如 port 的保守/推荐均为 3306 → label "保守/推荐"）；含字符串项或无 range 时不出 chips。
 */
const quickOptions = computed<NumberQuickOption[] | undefined>(() => {
  const range = props.param.range;
  if (
    !range ||
    typeof range.conservative !== 'number' ||
    typeof range.recommended !== 'number' ||
    typeof range.aggressive !== 'number'
  ) {
    return undefined;
  }
  const merged = new Map<number, string[]>();
  const entries = [
    [range.conservative, '保守'],
    [range.recommended, '推荐'],
    [range.aggressive, '激进'],
  ] as const;
  for (const [value, label] of entries) {
    const labels = merged.get(value);
    if (labels) {
      if (!labels.includes(label)) labels.push(label);
    } else {
      merged.set(value, [label]);
    }
  }
  return [...merged.entries()].map(([value, labels]) => ({
    value,
    label: labels.length > 1 ? labels.join('/') : labels[0],
  }));
});

/** range 含字符串项（相对量如 '60% 内存'）时的参考文案，数值项形态为空 */
const rangeHint = computed(() => {
  const range = props.param.range;
  if (
    !range ||
    (typeof range.conservative === 'number' &&
      typeof range.recommended === 'number' &&
      typeof range.aggressive === 'number')
  ) {
    return '';
  }
  return `参考：保守 ${range.conservative} · 推荐 ${range.recommended} · 激进 ${range.aggressive}`;
});

/** 开关当前值 */
const boolValue = computed(() => props.value === true);

/** 文本当前值 */
const textValue = computed(() =>
  props.value === null || props.value === undefined ? '' : String(props.value),
);

/**
 * 下拉变更（选项值均为字符串形态）。
 * @param value - 选中的选项值
 */
function onSelectChange(value: string | number): void {
  emit('update', value);
}

/**
 * 数值输入变更。
 * @param value - 新数值
 */
function onNumberChange(value: number): void {
  emit('update', value);
}

/**
 * 开关变更。
 * @param value - 新布尔值
 */
function onSwitchChange(value: boolean): void {
  emit('update', value);
}
</script>

<template>
  <!-- 废弃提示行：参数在目标版本已废弃，面板保留说明、conf 不输出 -->
  <div v-if="deprecated" class="rounded-md border border-warning/40 bg-warning/10 p-3">
    <div class="flex flex-wrap items-center gap-2">
      <code class="font-mono text-[0.8125rem] font-medium text-foreground">{{ param.key }}</code>
      <span class="rounded-sm border border-warning px-1.5 py-px text-[0.625rem] font-medium leading-none text-warning">
        已废弃 {{ param.deprecatedIn }}+
      </span>
    </div>
    <p class="mt-1.5 text-[0.8125rem] leading-relaxed text-foreground">
      <template v-if="param.replacedBy">
        自 {{ param.deprecatedIn }} 起已废弃，请改用
        <code class="rounded-sm bg-accent px-1 font-mono text-xs text-foreground">{{ param.replacedBy }}</code>
        。
      </template>
      <template v-else>自 {{ param.deprecatedIn }} 起已废弃且无效，请从配置中移除该行。</template>
      {{ param.comment }}
    </p>
  </div>

  <!-- 正常参数行 -->
  <div v-else class="py-4">
    <div class="flex flex-wrap items-center gap-2">
      <code class="font-mono text-[0.8125rem] font-medium text-foreground">{{ param.key }}</code>
      <span
        v-if="badge"
        class="rounded-full border border-info/40 bg-info/10 px-1.5 py-px text-[0.625rem] font-medium leading-none text-info"
        :title="`MySQL ${badge} 起引入`"
      >{{ badge }}+</span>
      <span v-if="hasOverride" class="text-[0.625rem] leading-none text-muted-foreground">已自定义</span>
      <button
        v-if="hasOverride"
        type="button"
        class="ml-auto rounded-sm border border-border bg-card px-2 py-0.5 text-[0.6875rem] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
        title="恢复为当前画像的推荐值"
        @click="emit('reset')"
      >
        重置推荐
      </button>
      <a
        v-else
        :href="param.docUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-auto text-[0.6875rem] text-muted-foreground transition-[color] duration-150 hover:text-primary"
      >文档 ↗</a>
    </div>

    <div class="mt-2">
      <!-- 枚举下拉 -->
      <SelectListbox
        v-if="param.control === 'select'"
        :model-value="stringValue"
        :options="selectOptions"
        button-class="h-8"
        @update:model-value="onSelectChange"
      />

      <!-- 连续数值输入（附推荐快捷选项；相对量参数显示参考文案） -->
      <template v-else-if="param.control === 'number'">
        <NumberField
          :model-value="Number(value ?? param.min ?? 0)"
          :min="param.min"
          :max="param.max"
          :step="param.step"
          :unit="PARAM_UNITS[param.key]"
          :quick-options="quickOptions"
          :label="param.key"
          @update:model-value="onNumberChange"
        />
        <p v-if="rangeHint" class="mt-1 text-[0.6875rem] text-muted-foreground">{{ rangeHint }}</p>
      </template>

      <!-- 布尔开关 -->
      <ToggleSwitch
        v-else-if="param.control === 'switch'"
        :model-value="boolValue"
        :show-status="false"
        @update:model-value="onSwitchChange"
      />

      <!-- 文本（如 bind_address 覆盖输入） -->
      <input
        v-else
        type="text"
        :value="textValue"
        :aria-label="param.key"
        :placeholder="param.key === 'bind_address' ? '如 10.0.0.5（留空则不写入 conf）' : '未设置（留空则不写入 conf）'"
        class="w-full min-w-0 rounded-sm border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
        @input="emit('update', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <p class="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{{ param.comment }}</p>
  </div>
</template>
