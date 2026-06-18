<script setup lang="ts">
/**
 * 进制转换器交互组件。
 *
 * 支持二/八/十/十六进制批量互转，展示结果表格与逐位二进制预览。
 */
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import { useCopy } from '../../composables/useCopy';
import {
  type Base,
  type ParseResult,
  BASE_OPTIONS,
  parseNumber,
  convertNumber,
  getPreviewBitWidth,
  formatBinaryPreview,
} from '../../utils/text/number-base-converter';

/** 单行解析结果（含错误） */
interface LineResult {
  lineNumber: number;
  raw: string;
  parsed: ParseResult | null;
  error: string;
  /** 预计算的目标进制显示值 */
  converted?: {
    binary: string;
    octal: string;
    decimal: string;
    hex: string;
  };
}

// ---- 状态 ----
const sourceBase = ref<Base>(16);
const inputText = ref('1A3F\n-255\n11001010');
const selectedLine = ref<number | null>(null);

const { copy } = useCopy();

// ---- 解析结果 ----
const lineResults = computed<LineResult[]>(() => {
  const lines = inputText.value.split('\n');
  const results: LineResult[] = [];

  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    if (trimmed.length > 10000) {
      results.push({
        lineNumber: index + 1,
        raw: trimmed,
        parsed: null,
        error: `第 ${index + 1} 行过长，已跳过`,
      });
      return;
    }

    const parsed = parseNumber(trimmed, sourceBase.value);
    const error = parsed === null ? '包含无效字符，请检查当前进制' : '';

    results.push({
      lineNumber: index + 1,
      raw: trimmed,
      parsed,
      error,
      converted: parsed
        ? {
            binary: convertNumber(parsed.value, 2),
            octal: convertNumber(parsed.value, 8),
            decimal: convertNumber(parsed.value, 10),
            hex: convertNumber(parsed.value, 16),
          }
        : undefined,
    });
  });

  return results;
});

const validResults = computed(() => lineResults.value.filter((r) => r.parsed !== null));
const hasErrors = computed(() => lineResults.value.some((r) => r.error));

const selectedResult = computed(() => {
  if (selectedLine.value === null) return null;
  return validResults.value.find((r) => r.lineNumber === selectedLine.value) ?? null;
});

// ---- 操作 ----
function handleBaseChange(): void {
  selectedLine.value = null;
}

function handleClear(): void {
  inputText.value = '';
  selectedLine.value = null;
}

function selectLine(lineNumber: number): void {
  selectedLine.value = selectedLine.value === lineNumber ? null : lineNumber;
}

function buildCopyText(): string {
  return validResults.value
    .map((r) => {
      const c = r.converted!;
      return `${r.raw} = 二进制 ${c.binary} / 八进制 ${c.octal} / 十进制 ${c.decimal} / 十六进制 ${c.hex}`;
    })
    .join('\n');
}

async function handleCopyAll(): Promise<void> {
  const text = buildCopyText();
  if (!text) return;
  await copy(text);
}

// ---- 二进制显示 ----
function binaryPreviewValue(value: bigint, negative: boolean): string {
  return formatBinaryPreview(value, getPreviewBitWidth(value, negative));
}

// ---- 监听 ----
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(inputText, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    selectedLine.value = null;
  }, 150);
});
watch(sourceBase, handleBaseChange);
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="进制转换器"
      description="二进制、八进制、十进制、十六进制批量互转，支持大整数与负数补码二进制预览。"
      :show-example="false"
    />

    <!-- 输入区 -->
    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <OptionRadioGroup
        v-model="sourceBase"
        label="输入进制"
        :options="BASE_OPTIONS"
      />

      <div>
        <label class="block text-[0.8125rem] text-muted mb-1.5">输入数字（每行一个）</label>
        <textarea
          v-model="inputText"
          rows="6"
          class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent resize-y"
          placeholder="在此逐行输入数字..."
        />
        <p v-if="hasErrors" class="mt-1.5 text-xs text-error">部分行包含无效字符，请检查当前进制。</p>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
          @click="handleClear"
        >
          清空
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="validResults.length === 0"
          @click="handleCopyAll"
        >
          复制全部结果
        </button>
      </div>
    </div>

    <!-- 结果表格 -->
    <div class="border border-border rounded-md bg-card mt-6 overflow-hidden">
      <div
        v-if="lineResults.length === 0"
        class="min-h-[120px] flex items-center justify-center text-muted text-sm"
      >
        输入数字后将自动显示转换结果
      </div>

      <table v-else class="w-full text-left text-sm">
        <thead class="bg-surface border-b border-border sticky top-0">
          <tr>
            <th class="px-4 py-2 text-xs text-muted font-medium w-14">行号</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">二进制</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">八进制</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">十进制</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">十六进制</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="result in lineResults"
            :key="result.lineNumber"
            class="border-b border-border last:border-b-0 cursor-pointer hover:bg-hover transition-colors duration-150"
            :class="selectedLine === result.lineNumber ? 'bg-hover' : ''"
            @click="selectLine(result.lineNumber)"
          >
            <td class="px-4 py-2 text-xs text-muted">{{ result.lineNumber }}</td>
            <td
              v-if="result.parsed"
              class="px-4 py-2 font-mono text-text break-all"
            >
              {{ result.converted!.binary }}
            </td>
            <td v-else colspan="4" class="px-4 py-2 text-error text-xs">
              {{ result.error }}
            </td>
            <template v-if="result.parsed">
              <td class="px-4 py-2 font-mono text-text break-all">{{ result.converted!.octal }}</td>
              <td class="px-4 py-2 font-mono text-text break-all">{{ result.converted!.decimal }}</td>
              <td class="px-4 py-2 font-mono text-text break-all">{{ result.converted!.hex }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 二进制位图预览 -->
    <div
      v-if="selectedResult"
      class="border border-border rounded-md p-6 bg-card mt-4"
    >
      <h2 class="text-sm font-semibold text-text mb-3">
        第 {{ selectedResult.lineNumber }} 行二进制位图
      </h2>
      <div class="font-mono text-sm text-text break-all leading-relaxed">
        {{ binaryPreviewValue(selectedResult.parsed.value, selectedResult.parsed.negative) }}
      </div>
    </div>
  </div>
</template>
