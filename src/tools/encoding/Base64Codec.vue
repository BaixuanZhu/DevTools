<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import { encodeBase64, decodeBase64 } from '../../utils/encoding/base64';

/** 解码字符集选项（编码固定 UTF-8，仅解码可选） */
const CHARSET_OPTIONS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK（简体中文）' },
  { value: 'big5', label: 'Big5（繁体中文）' },
  { value: 'shift_jis', label: 'Shift_JIS（日文）' },
  { value: 'euc-kr', label: 'EUC-KR（韩文）' },
  { value: 'iso-8859-1', label: 'ISO-8859-1（Latin-1）' },
];

/** 输入内容 */
const input = ref('');
/** 输出结果 */
const output = ref('');
/** 错误信息（显示在输出面板内） */
const errorMsg = ref('');
/** 解码时是否过滤非 Base64 字符 */
const filterInvalid = ref(false);
/** 解码目标字符集 */
const charset = ref('utf-8');

/** 执行编码：将输入文本编码为 Base64（固定 UTF-8） */
function executeEncode() {
  errorMsg.value = '';
  output.value = '';

  if (!input.value.trim()) {
    errorMsg.value = '请输入要编码的文本';
    return;
  }

  try {
    output.value = encodeBase64(input.value);
  } catch (e) {
    output.value = '';
    errorMsg.value = e instanceof Error ? e.message : '编码时出错';
  }
}

/** 执行解码：将输入的 Base64 解码为文本，应用所选字符集与过滤选项 */
function executeDecode() {
  errorMsg.value = '';
  output.value = '';

  if (!input.value.trim()) {
    errorMsg.value = '请输入要解码的 Base64 字符串';
    return;
  }

  try {
    output.value = decodeBase64(input.value, {
      charset: charset.value,
      filterInvalid: filterInvalid.value,
    });
  } catch (e) {
    output.value = '';
    errorMsg.value = e instanceof Error ? e.message : '解码时出错';
  }
}

/** 交换输入与输出内容，便于反向编解码；交换后不自动执行，由用户点击编码/解码 */
function handleSwap(): void {
  const temp = input.value;
  input.value = output.value;
  output.value = temp;
  errorMsg.value = '';
}

/** 清空输入、输出与错误信息 */
function handleClear() {
  input.value = '';
  output.value = '';
  errorMsg.value = '';
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl">
    <ToolHeader
      title="Base64 编解码"
      description="Base64 编码与解码，支持多字符集与非法字符过滤"
      :show-example="false"
    />

    <!-- 输入面板 -->
    <CodePanel label="输入" show-copy :copy-text="input">
      <textarea
        v-model="input"
        class="w-full h-60 p-4 bg-card text-text font-mono text-sm resize-y box-border focus:outline-none"
        placeholder="输入要编码的文本或要解码的 Base64 字符串"
      ></textarea>
    </CodePanel>

    <!-- 操作栏：编码/解码/互换/清空 + 解码选项合并为单一区域 -->
    <div class="flex flex-wrap gap-2 items-center mt-3">
      <button
        class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 active:brightness-90"
        @click="executeEncode"
      >编码</button>
      <button
        class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 active:brightness-90"
        @click="executeDecode"
      >解码</button>
      <button
        class="flex items-center gap-1.5 px-4 py-2 border border-border rounded-sm bg-card text-muted text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
        @click="handleSwap"
      >
        <span>⇄</span>
        <span>互换</span>
      </button>
      <ClearButton @clear="handleClear" />
      <div class="w-px h-6 bg-border mx-1 hidden sm:block"></div>
      <ToggleSwitch v-model="filterInvalid" label="过滤非法字符" />
      <div class="w-44">
        <SelectListbox
          :model-value="charset"
          :options="CHARSET_OPTIONS"
          @update:model-value="charset = String($event)"
        />
      </div>
    </div>

    <!-- 输出面板（错误信息也在此显示） -->
    <CodePanel label="输出" show-copy :copy-text="output" class="mt-3">
      <div
        v-if="output"
        class="w-full h-60 p-4 m-0 bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap break-all"
      >{{ output }}</div>
      <div
        v-else-if="errorMsg"
        class="w-full h-60 p-4 m-0 bg-card text-error font-mono text-sm overflow-auto whitespace-pre-wrap break-all"
      >{{ errorMsg }}</div>
      <div
        v-else
        class="w-full h-60 p-4 m-0 bg-card text-muted font-mono text-sm"
      >点击「编码」或「解码」查看结果</div>
    </CodePanel>
  </div>
</template>
