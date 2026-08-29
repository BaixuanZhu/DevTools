<script setup lang="ts">
/**
 * 参数行控件（配置生成器系列共享，redis/mysql 两版超集合并）：
 * 按参数定义渲染 5 种控件之一，附参数名、版本徽章、官方文档链接、中文说明与单参重置；
 * 目标版本下已废弃的参数渲染为"废弃提示行"（不渲染控件、不写 conf）。
 *
 * 徽章基线由 baselineVersion prop 决定（redis 'pre-7' / mysql '5.7' / pg '16'），
 * 与基线相同的引入版本不显示徽章（全表同版本时徽章是噪音）。
 * 密码类参数（param.secret 且 enableSecret）点击"生成"仅 emit generate-secret，
 * 随机生成逻辑（crypto.getRandomValues）留在各工具页面侧，本组件不感知实现。
 * 版本可用性判断不进本组件——父层据引擎 isAvailable 决定渲染还是传 deprecated。
 */
import { computed } from 'vue';
import type { ConfigParamBase, ParamValue } from './types';
import { PARAM_UNITS } from './types';
import SelectListbox from '../ui/SelectListbox.vue';
import ToggleSwitch from '../ui/ToggleSwitch.vue';
import NumberField from './NumberField.vue';
import type { NumberQuickOption } from './NumberField.vue';

const props = withDefaults(
  defineProps<{
    /** 参数定义（共享基类形态；工具侧 extends 携带 group/compute 等额外字段） */
    param: ConfigParamBase;
    /** 当前生效值（override ?? compute；废弃行可为 null） */
    value: ParamValue | null;
    /** 当前上下文的 compute 推荐值（下拉"推荐"标记依据） */
    recommended: ParamValue | null;
    /** 目标版本（版本枚举的字符串形态，随页面上下文传入） */
    version: string;
    /** 徽章基线版本：introducedIn 与之相同则不显示徽章 */
    baselineVersion: string;
    /** 用户是否覆盖了推荐值 */
    hasOverride: boolean;
    /** 是否渲染为废弃提示行 */
    deprecated?: boolean;
    /** 是否启用密码类参数的"生成"按钮（需同时 param.secret；点击 emit generate-secret） */
    enableSecret?: boolean;
    /** 工具名（版本徽章 title 前缀，如 'Redis' / 'MySQL'；缺省不加前缀） */
    productLabel?: string;
    /** 文本输入占位文案（缺省"未设置"；工具专有提示由页面按参数传入） */
    placeholder?: string;
  }>(),
  {
    deprecated: false,
    enableSecret: false,
    productLabel: undefined,
    placeholder: undefined,
  },
);

const emit = defineEmits<{
  /** 值变更（原始类型，父层写入 overrides） */
  update: [value: ParamValue];
  /** 恢复该参数为推荐值 */
  reset: [];
  /** 生成随机密码（仅密码类参数的"生成"按钮触发，由页面侧生成并写回） */
  'generate-secret': [];
}>();

/** 与徽章基线相同的引入版本不显示徽章 */
const badge = computed(() =>
  props.param.introducedIn === props.baselineVersion ? null : props.param.introducedIn,
);

/** 徽章无障碍提示：productLabel 缺省时省略工具名前缀 */
const badgeTitle = computed(() =>
  `${props.productLabel ? `${props.productLabel} ` : ''}${props.param.introducedIn} 起引入`,
);

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
 * （如 port 的保守/推荐均为 6379 → label "保守/推荐"）；含字符串项或无 range 时不出 chips。
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

/** 多选键位当前值 */
const listValue = computed(() => (Array.isArray(props.value) ? props.value : []));

/** 文本当前值 */
const textValue = computed(() =>
  props.value === null || props.value === undefined ? '' : String(props.value),
);

/**
 * 切换多选键位，emit 新数组。
 * @param key - 键位字符（如 'E'）
 * @param checked - 是否勾选
 */
function toggleKey(key: string, checked: boolean): void {
  const next = checked ? [...listValue.value, key] : listValue.value.filter((k) => k !== key);
  emit('update', next);
}

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
        :title="badgeTitle"
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

      <!-- 键位多选 -->
      <div v-else-if="param.control === 'multi-select'" class="flex flex-wrap gap-x-4 gap-y-1.5">
        <label
          v-for="o in param.options"
          :key="o.value"
          class="inline-flex cursor-pointer items-center gap-1.5 text-[0.8125rem] text-foreground"
        >
          <input
            type="checkbox"
            class="h-3.5 w-3.5 cursor-pointer accent-primary"
            :checked="listValue.includes(o.value)"
            @change="toggleKey(o.value, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ o.label }}</span>
        </label>
      </div>

      <!-- 文本（密码类附"生成"按钮，密码生成经 generate-secret 事件交页面侧处理） -->
      <div v-else class="flex gap-2">
        <input
          type="text"
          :value="textValue"
          :aria-label="param.key"
          :placeholder="placeholder ?? '未设置（留空则不写入 conf）'"
          class="w-full min-w-0 rounded-sm border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
          @input="emit('update', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="enableSecret && param.secret"
          type="button"
          class="shrink-0 rounded-sm border border-border bg-card px-2.5 text-[0.8125rem] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
          title="本地生成 24 位随机密码（crypto.getRandomValues，不经网络）"
          @click="emit('generate-secret')"
        >
          生成
        </button>
      </div>
    </div>

    <p class="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{{ param.comment }}</p>
  </div>
</template>
