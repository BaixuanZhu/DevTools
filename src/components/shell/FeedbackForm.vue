<script setup lang="ts">
/**
 * 反馈建议表单。
 *
 * 用户填写类型/内容/联系方式后，拼装 mailto: 链接打开邮件客户端。
 * 内容为空时以 error toast 提示，成功时以 success toast 反馈。
 */
import { ref } from 'vue';
import { toastStore } from '../../stores/toast';

const FEEDBACK_MAILTO = 'wy2359117018@163.com';

const type = ref('功能建议');
const content = ref('');
const contact = ref('');

/** 提交：校验内容 → 拼 mailto → 打开邮件客户端 + toast 反馈 */
function submit(): void {
  if (!content.value.trim()) {
    toastStore.show('请填写反馈内容', 'error');
    return;
  }
  const subject = encodeURIComponent('[DevTools 反馈] ' + type.value);
  const body = encodeURIComponent(
    '反馈类型：' + type.value + '\n\n' +
    '反馈内容：\n' + content.value +
    (contact.value.trim() ? '\n\n联系方式：' + contact.value.trim() : ''),
  );
  window.location.href = `mailto:${FEEDBACK_MAILTO}?subject=${subject}&body=${body}`;
  toastStore.show('已打开邮件客户端，感谢你的反馈！');
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <div>
      <label for="feedback-type" class="block text-sm font-medium text-foreground mb-1.5">反馈类型</label>
      <select
        id="feedback-type"
        v-model="type"
        class="w-full px-3 py-2.5 border border-border rounded-sm bg-card text-foreground text-base font-sans transition-[border-color] duration-150 focus:border-primary focus:outline-none appearance-none cursor-pointer"
      >
        <option>功能建议</option>
        <option>Bug 报告</option>
        <option>体验问题</option>
        <option>其他</option>
      </select>
    </div>

    <div>
      <label for="feedback-content" class="block text-sm font-medium text-foreground mb-1.5">
        详细描述
        <span class="text-error text-xs ml-1">*</span>
      </label>
      <textarea
        id="feedback-content"
        v-model="content"
        placeholder="请描述你的建议或遇到的问题..."
        rows="6"
        required
        class="w-full px-3 py-2.5 border border-border rounded-sm bg-card text-foreground text-base font-sans transition-[border-color] duration-150 focus:border-primary focus:outline-none resize-y min-h-40 placeholder:text-muted-foreground"
      ></textarea>
    </div>

    <div>
      <label for="feedback-contact" class="block text-sm font-medium text-foreground mb-1.5">
        联系方式
        <span class="text-muted-foreground text-xs font-normal ml-1">（可选，方便我们跟进）</span>
      </label>
      <input
        id="feedback-contact"
        v-model="contact"
        type="text"
        placeholder="邮箱或微信号"
        class="w-full px-3 py-2.5 border border-border rounded-sm bg-card text-foreground text-base font-sans transition-[border-color] duration-150 focus:border-primary focus:outline-none placeholder:text-muted-foreground"
      />
    </div>

    <div class="pt-2">
      <button
        type="submit"
        class="px-6 py-2.5 bg-primary text-white rounded-sm font-medium text-base cursor-pointer border-none hover:opacity-90 transition-opacity"
      >
        发送反馈
      </button>
    </div>
  </form>
</template>
