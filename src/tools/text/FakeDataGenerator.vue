<script setup lang="ts">
/**
 * 假数据生成器交互组件。
 *
 * 通过动态字段行配置列名、类型与参数，批量生成结构化假数据记录，
 * 支持 JSON 数组与 CSV 两种输出格式，快速模板一键填充常见字段组合。
 */
import { ref, computed } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import { useCopy } from '../../composables/useCopy';
import {
  FIELD_TYPE_OPTIONS,
  QUICK_PRESETS,
  generateRecords,
  toJson,
  toCsv,
  validateFields,
  type FieldConfig,
  type FieldType,
  type FieldTypeMeta,
} from '../../utils/text/fake-data';

/** 行 id 自增计数器（避开 Math.random）。 */
let rowSeq = 0;
/** 生成一个新的行 id。 */
function nextRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

/** 按类型构造默认字段配置（列名取默认值、参数取默认值）。 */
function makeField(type: FieldType, name?: string): FieldConfig {
  const meta = FIELD_TYPE_OPTIONS.find((m) => m.value === type) as FieldTypeMeta;
  const params: Record<string, string | number> = {};
  for (const p of meta.params) params[p.key] = p.default;
  return { rowId: nextRowId(), name: name ?? meta.defaultName, type, params };
}

/** 当前字段配置（默认预填 id / name / email）。 */
const fields = ref<FieldConfig[]>([
  makeField('auto-id', 'id'),
  makeField('name', 'name'),
  makeField('email', 'email'),
]);

/** 生成条数。 */
const count = ref(10);
/** 输出格式。 */
const format = ref<'json' | 'csv'>('json');
/** 已生成的原始记录（切格式时不重新随机）。 */
const records = ref<Record<string, unknown>[]>([]);
/** 校验错误信息（内联提示）。 */
const errorMsg = ref('');

/** 序列化结果文本。 */
const output = computed(() => {
  if (!records.value.length) return '';
  return format.value === 'json' ? toJson(records.value) : toCsv(records.value, fields.value);
});

/** 类型下拉选项（Dialog 中使用）。 */
const typeOptions = FIELD_TYPE_OPTIONS.map((m) => ({ value: m.value, label: m.label }));

/** 添加一个默认字段行。 */
function addField(): void {
  fields.value.push(makeField('name', `field${fields.value.length + 1}`));
}

/** 删除指定字段行。 */
function removeField(rowId: string): void {
  fields.value = fields.value.filter((f) => f.rowId !== rowId);
}

/** 应用快速模板（整体替换字段配置）。 */
function applyPreset(idx: number): void {
  const preset = QUICK_PRESETS[idx];
  fields.value = preset.fields.map((f) => ({ ...f, params: { ...f.params }, rowId: nextRowId() }));
}

/** 钳制条数到 1–500。 */
function clampCount(): void {
  if (!Number.isFinite(count.value)) count.value = 10;
  count.value = Math.min(Math.max(Math.floor(count.value), 1), 500);
}

/** 生成记录。 */
function generate(): void {
  clampCount();
  const result = validateFields(fields.value);
  if (!result.valid) {
    errorMsg.value = result.error;
    return;
  }
  errorMsg.value = '';
  records.value = generateRecords(fields.value, count.value);
}

/** 清空结果（保留字段配置）。 */
function clearResult(): void {
  records.value = [];
  errorMsg.value = '';
}

const { copy } = useCopy();

/** Dialog 开关状态。 */
const dialogOpen = ref(false);
/** 当前正在编辑的字段配置副本。 */
const editingField = ref<FieldConfig>(makeField('name'));

/** 打开字段配置 Dialog，复制当前字段到编辑副本。 */
function openFieldDialog(field: FieldConfig): void {
  editingField.value = {
    rowId: field.rowId,
    name: field.name,
    type: field.type,
    params: { ...field.params },
  };
  dialogOpen.value = true;
}

/** 保存 Dialog 中的字段配置，更新 fields 数组对应项。 */
function saveFieldConfig(): void {
  const updated = editingField.value;
  const idx = fields.value.findIndex((f) => f.rowId === updated.rowId);
  if (idx === -1) return;
  fields.value[idx] = { ...updated };
  dialogOpen.value = false;
}

/** Dialog 中切换类型时重置参数默认值。 */
function onDialogTypeChange(type: FieldType): void {
  editingField.value.type = type;
  const meta = FIELD_TYPE_OPTIONS.find((m) => m.value === type) as FieldTypeMeta;
  const params: Record<string, string | number> = {};
  for (const p of meta.params) params[p.key] = p.default;
  editingField.value.params = params;
}

/** Dialog 中当前类型的参数元数据。 */
const dialogParamDefs = computed<FieldTypeMeta['params']>(() => {
  return (FIELD_TYPE_OPTIONS.find((m) => m.value === editingField.value.type) as FieldTypeMeta).params;
});
</script>

<template>
  <div class="max-w-5xl mx-auto w-full">
    <ToolHeader
      title="假数据生成器"
      description="按字段配置批量生成姓名、邮箱、手机号、UUID、Lorem 等结构化假数据，输出 JSON 或 CSV。"
      :show-example="false"
    />

    <!-- 快速模板 -->
    <div class="border border-border rounded-md p-4 bg-card flex items-center gap-2 flex-wrap">
      <span class="text-[0.8125rem] text-muted">快速模板</span>
      <button
        v-for="(preset, idx) in QUICK_PRESETS"
        :key="idx"
        type="button"
        class="px-3 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
        @click="applyPreset(idx)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- 字段配置区 -->
    <div class="mt-4 border border-border rounded-md bg-card overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 border-b border-border">
        <span class="text-[0.8125rem] text-muted">字段配置</span>
        <button
          type="button"
          class="px-3 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
          @click="addField"
        >
          + 添加字段
        </button>
      </div>

      <div class="divide-y divide-border">
        <div
          v-for="field in fields"
          :key="field.rowId"
          class="px-4 py-3"
        >
          <!-- 第一行：列名 + 类型标签 + 删除 -->
          <div class="flex items-center gap-3">
            <input
              v-model="field.name"
              type="text"
              class="flex-1 min-w-[160px] px-3 py-1.5 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="列名"
              aria-label="列名"
            />
            <span class="shrink-0 px-2 py-0.5 bg-hover text-text border border-border rounded-sm text-[0.8125rem]">
              {{ (FIELD_TYPE_OPTIONS.find((m) => m.value === field.type) as FieldTypeMeta).label }}
            </span>
            <button
              type="button"
              class="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-card text-muted cursor-pointer hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              title="删除字段"
              aria-label="删除字段"
              @click="removeField(field.rowId)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <!-- 第二行：配置生成器 -->
          <div class="flex items-center gap-2 mt-2">
            <button
              type="button"
              class="px-3 py-1 border border-border rounded-sm bg-surface text-muted text-[0.8125rem] cursor-pointer hover:bg-hover hover:text-text hover:border-accent transition-[background-color,border-color,color] duration-150"
              @click="openFieldDialog(field)"
            >
              配置生成器
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 生成控制 -->
    <div class="mt-4 flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted">条数</span>
        <input
          v-model.number="count"
          type="number"
          min="1"
          max="500"
          class="px-2 py-1 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[80px]"
          @blur="clampCount"
        />
      </div>
      <button
        type="button"
        class="px-6 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90 transition-[opacity] duration-150"
        @click="generate"
      >
        生成
      </button>
      <button
        type="button"
        class="px-6 py-2 bg-surface border border-border text-text rounded-sm text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
        @click="clearResult"
      >
        清空
      </button>
    </div>
    <p v-if="errorMsg" class="mt-2 text-xs text-error">{{ errorMsg }}</p>

    <!-- 结果区 -->
    <div class="mt-6">
      <div v-if="!output" class="border border-border rounded-md bg-card min-h-[120px] flex items-center justify-center">
        <p class="text-muted text-[0.8125rem]">配置字段后点击「生成」</p>
      </div>
      <div v-else class="border border-border rounded-md bg-card overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-border">
          <OptionRadioGroup
            v-model="format"
            :options="[{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }]"
          />
          <div class="flex items-center gap-2">
            <span class="text-[0.75rem] text-muted">{{ records.length }} 条记录</span>
            <CopyButton :text="output" />
          </div>
        </div>
        <textarea
          readonly
          :value="output"
          rows="14"
          class="w-full px-3 py-2 bg-background text-text text-[0.8125rem] font-mono outline-none resize-y box-border"
          aria-label="生成结果"
        ></textarea>
      </div>
    </div>

    <!-- 字段配置 Dialog -->
    <TransitionRoot appear :show="dialogOpen" as="template">
      <Dialog as="div" class="relative z-50" @close="dialogOpen = false">
        <TransitionChild
          as="template"
          enter="ease-out duration-150"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-150"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/20" aria-hidden="true" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as="template"
              enter="ease-out duration-150"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md rounded-md bg-card border border-border p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <DialogTitle class="text-base font-semibold text-text">
                  编辑「{{ editingField.name }}」生成器
                </DialogTitle>

                <div class="mt-4 space-y-4">
                  <!-- 列名 -->
                  <div>
                    <label class="block text-[0.8125rem] text-muted mb-1">列名</label>
                    <input
                      v-model="editingField.name"
                      type="text"
                      class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150"
                    />
                  </div>

                  <!-- 类型 -->
                  <div>
                    <label class="block text-[0.8125rem] text-muted mb-1">生成器类型</label>
                    <SelectListbox
                      :model-value="editingField.type"
                      :options="typeOptions"
                      @update:model-value="(v) => onDialogTypeChange(v as FieldType)"
                    />
                  </div>

                  <!-- 参数 -->
                  <div v-if="dialogParamDefs.length" class="space-y-3">
                    <label class="block text-[0.8125rem] text-muted">参数</label>
                    <div
                      v-for="def in dialogParamDefs"
                      :key="def.key"
                      class="flex items-center gap-3"
                    >
                      <span class="text-[0.8125rem] text-muted w-16 shrink-0">{{ def.label }}</span>
                      <div v-if="def.type === 'select'" class="flex-1">
                        <SelectListbox
                          :model-value="String(editingField.params[def.key])"
                          :options="def.options ?? []"
                          @update:model-value="(v) => (editingField.params[def.key] = v)"
                        />
                      </div>
                      <input
                        v-else
                        v-model="editingField.params[def.key]"
                        :type="def.type"
                        class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150"
                      />
                    </div>
                  </div>
                </div>

                <div class="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    class="px-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
                    @click="dialogOpen = false"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90 transition-[opacity] duration-150"
                    @click="saveFieldConfig"
                  >
                    保存
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>
