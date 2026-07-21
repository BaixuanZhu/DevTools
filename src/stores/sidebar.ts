import { ref } from 'vue';
import type { Ref } from 'vue';

/** 移动端侧栏抽屉开合状态 */
const isOpen = ref(false) as Ref<boolean>;

/** 打开侧栏 */
function open(): void {
  isOpen.value = true;
}

/** 关闭侧栏 */
function close(): void {
  isOpen.value = false;
}

/** 切换侧栏开合 */
function toggle(): void {
  isOpen.value = !isOpen.value;
}

/** 侧栏全局单例 store（替代 Alpine sidebar-toggle/close 事件） */
export const sidebarStore = { isOpen, open, close, toggle };
