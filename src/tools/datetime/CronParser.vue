<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import DisclosureSection from '../../components/ui/DisclosureSection.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseCronExpression,
  buildCronFromFields,
  getFieldsFromExpression,
  formatExecutionTime,
  CRON_TEMPLATES,
  FIELD_OPTIONS,
  FIELD_LABELS,
  type CronFields,
} from '../../utils/datetime/cron';

const expression = ref('*/5 * * * *');
const errorMsg = ref('');
const executions = ref<string[]>([]);
const isBuilderOpen = ref(false);

const fields = ref<CronFields>({
  minute: '*/5',
  hour: '*',
  day: '*',
  month: '*',
  dayOfWeek: '*',
});

function parse() {
  errorMsg.value = '';
  executions.value = [];

  if (!expression.value.trim()) return;

  try {
    const result = parseCronExpression(expression.value);
    executions.value = result.nextExecutions.map(formatExecutionTime);
    fields.value = result.fields;
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解析时出错';
  }
}

// 输入变化时尝试实时解析
watch(expression, () => {
  const trimmed = expression.value.trim();
  if (!trimmed) {
    executions.value = [];
    errorMsg.value = '';
    return;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    parse();
  }
});

// 构建器字段变化时同步到表达式
watch(
  fields,
  (newFields) => {
    expression.value = buildCronFromFields(newFields);
  },
  { deep: true },
);

function handleTemplate(template: (typeof CRON_TEMPLATES)[number]) {
  expression.value = template.expression;
  fields.value = getFieldsFromExpression(template.expression);
}

function handleClear() {
  expression.value = '';
  errorMsg.value = '';
  executions.value = [];
  fields.value = { minute: '*', hour: '*', day: '*', month: '*', dayOfWeek: '*' };
}

function copyExecutions(): string {
  return executions.value.map((t, i) => `#${i + 1}  ${t}`).join('\n');
}

// 初始解析
parse();
</script>

<template>
  <div class="max-w-[760px]">
    <ToolHeader
      title="Cron 表达式解析器"
      description="解析 Cron 表达式，预览执行时间，可视化构建"
      :show-example="false"
    />

    <!-- Cron 输入框 -->
    <div class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">
        Cron 表达式
      </label>
      <input
        v-model="expression"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
        placeholder="*/5 * * * *"
      />
    </div>

    <div class="flex gap-2 items-center mb-3">
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

    <!-- 常用模板 -->
    <div class="mb-4">
      <label class="block text-[0.8125rem] text-muted font-medium mb-2">常用模板</label>
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="template in CRON_TEMPLATES"
          :key="template.expression"
          class="px-2.5 py-1 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 hover:bg-hover hover:text-text"
          @click="handleTemplate(template)"
        >
          {{ template.label }}
        </button>
      </div>
    </div>

    <!-- 可视化构建器 -->
    <DisclosureSection title="可视化构建器" v-model="isBuilderOpen">
      <div class="grid grid-cols-5 gap-3">
        <div v-for="(options, fieldKey) in FIELD_OPTIONS" :key="fieldKey" class="flex flex-col gap-1">
          <label class="text-[0.75rem] text-muted font-medium">
            {{ FIELD_LABELS[fieldKey as keyof CronFields] }}
          </label>
          <SelectListbox
            :model-value="fields[fieldKey as keyof CronFields]"
            :options="options"
            @update:model-value="(val: string) => { fields[fieldKey as keyof CronFields] = val }"
          />
        </div>
      </div>
    </DisclosureSection>

    <!-- 执行时间列表 -->
    <div v-if="executions.length" class="mt-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold m-0 text-text">下次执行时间</h3>
        <CopyButton :text="copyExecutions" label="复制列表" />
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="(time, index) in executions"
          :key="index"
          class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card"
        >
          <span class="text-xs font-semibold text-accent min-w-[32px] shrink-0">#{{ index + 1 }}</span>
          <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ time }}</code>
        </div>
      </div>
    </div>
  </div>
</template>
