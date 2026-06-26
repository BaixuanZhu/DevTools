<script setup lang="ts">
/**
 * 转盘抽奖工具组件。
 *
 * - 左侧：结构化选项列表（名称+权重）、批量粘贴导入、操作按钮
 * - 右侧：Canvas 转盘与旋转动画（后续任务填充）
 */
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import { ref, onMounted, watch, nextTick } from 'vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import { useCopy } from '../../composables/useCopy';
import {
  type WheelItem,
  MAX_ITEMS,
  normalizeWeight,
  parseBatch,
  DEFAULT_ITEMS,
  computeSectors,
  sliceColor,
  pickWeightedIndex,
  createCryptoRng,
  computeTargetRotation,
  encodeShare,
  decodeShare,
} from '../../utils/text/wheel';

/** 活跃选项（可被抽中），唯一真相源 */
const items = ref<WheelItem[]>(DEFAULT_ITEMS.map((it) => ({ ...it })));
/** 批量导入文本框内容 */
const batchText = ref('');

/** 触发全局 toast 通知 */
function showToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 新增一个空选项 */
function addItem(): void {
  if (items.value.length >= MAX_ITEMS) {
    showToast(`选项数量已达上限 ${MAX_ITEMS} 个`);
    return;
  }
  items.value.push({ text: '', weight: 1 });
}

/** 删除指定下标选项 */
function removeItem(index: number): void {
  items.value.splice(index, 1);
}

/** 失焦时归一化权重输入 */
function normalizeItemWeight(index: number): void {
  items.value[index].weight = normalizeWeight(Number(items.value[index].weight));
}

/** 将批量文本解析后追加到现有列表（按名称去重，受上限约束） */
function importBatch(): void {
  const parsed = parseBatch(batchText.value);
  if (parsed.length === 0) {
    showToast('没有可导入的选项');
    return;
  }
  const existing = new Set(items.value.map((it) => it.text));
  let added = 0;
  for (const it of parsed) {
    if (items.value.length >= MAX_ITEMS) break;
    if (existing.has(it.text)) continue;
    existing.add(it.text);
    items.value.push(it);
    added++;
  }
  batchText.value = '';
  showToast(added > 0 ? `已导入 ${added} 个选项` : '选项已存在，未新增');
}

/** 不重复抽取开关，默认关闭 */
const noRepeat = ref(false);
/** 已中奖项列表（不重复模式下从 items 移出） */
const wonItems = ref<WheelItem[]>([]);

/** 旋转结束：记录结果；不重复模式下按对象身份匹配将中奖项移入已中奖列表，避免同名同权重项误删 */
function onSpinEnd(winner: WheelItem): void {
  result.value = winner.text;
  if (noRepeat.value) {
    const idx = items.value.findIndex((it) => it === winner);
    if (idx !== -1) {
      const [removed] = items.value.splice(idx, 1);
      wonItems.value.push(removed);
      void nextTick(() => draw());
    }
  }
}

/** 将某已中奖项恢复回转盘 */
function restoreWon(index: number): void {
  const [restored] = wonItems.value.splice(index, 1);
  if (restored) {
    items.value.push(restored);
    void nextTick(() => draw());
  }
}

/** 全部重置：将所有已中奖项恢复回转盘并清空已中奖列表 */
function resetWon(): void {
  for (const it of wonItems.value) items.value.push(it);
  wonItems.value = [];
  void nextTick(() => draw());
}

/** 清空：恢复默认示例 */
function clearAll(): void {
  items.value = DEFAULT_ITEMS.map((it) => ({ ...it }));
  wonItems.value = [];
  batchText.value = '';
  result.value = '';
  void nextTick(() => draw());
}

const { copied: linkCopied, copy: copyLink } = useCopy();

/** 分享链接长度护栏阈值 */
const SHARE_URL_MAX = 2000;

/** 生成并复制分享链接（编码当前有效选项及权重） */
async function copyShareLink(): Promise<void> {
  const list = validItems();
  if (list.length < 2) {
    showToast('请先添加至少 2 个选项');
    return;
  }
  const data = encodeShare(list);
  const url = `${window.location.origin}${window.location.pathname}?data=${data}`;
  if (url.length > SHARE_URL_MAX) {
    showToast('选项过多，链接可能在部分平台被截断');
  }
  await copyLink(url);
  if (linkCopied.value) showToast('分享链接已复制');
}

/** 从 URL ?data= 直接解码加载（失败则静默回退默认示例） */
function loadFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');
  if (!data) return;
  try {
    const loaded = decodeShare(data);
    items.value = loaded;
    wonItems.value = [];
    result.value = '';
  } catch {
    showToast('分享链接无效，已载入默认示例');
  }
}

/** Canvas 引用 */
const canvasRef = ref<HTMLCanvasElement | null>(null);
/** 当前旋转角（度） */
const rotation = ref(0);
/** 是否旋转中（锁定交互） */
const spinning = ref(false);
/** 最近一次中奖项文本 */
const result = ref<string>('');

/** 有效选项（名称非空），用于绘制与抽取 */
function validItems(): WheelItem[] {
  return items.value.filter((it) => it.text.trim().length > 0);
}

const rng = createCryptoRng();
const CANVAS_SIZE = 320; // CSS 像素

/** 将转盘绘制到 Canvas（按当前 rotation 与有效选项） */
function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const list = validItems();
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const radius = CANVAS_SIZE / 2 - 4;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  if (list.length < 2) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('请添加至少 2 个选项', cx, cy);
    return;
  }

  const sectors = computeSectors(list);
  sectors.forEach((s, i) => {
    const start = toRad(s.startDeg + rotation.value);
    const end = toRad(s.endDeg + rotation.value);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = sliceColor(i, sectors.length);
    ctx.fill();
    // 文字
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(toRad(s.midDeg + rotation.value));
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1f2937';
    ctx.font = '13px sans-serif';
    const label = list[i].text.length > 8 ? list[i].text.slice(0, 7) + '…' : list[i].text;
    ctx.fillText(label, radius - 10, 4);
    ctx.restore();
  });
}

/** easeOutCubic 缓动 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 旋转抽取：先按权重选出中奖项，再以 easeOutCubic 缓动旋转到目标角。
 * 动画结束调用 onSpinEnd 设置 result 并处理不重复移除。
 */
function spin(): void {
  const list = validItems();
  if (spinning.value || list.length < 2) return;
  spinning.value = true;
  result.value = '';

  const winnerIndex = pickWeightedIndex(list.map((it) => it.weight), rng);
  const sectors = computeSectors(list);
  const winnerMid = sectors[winnerIndex].midDeg;
  const start = rotation.value;
  const target = computeTargetRotation(start, winnerMid, 5);
  const duration = 4000;
  const startTime = performance.now();

  function frame(now: number): void {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    rotation.value = start + (target - start) * easeOutCubic(t);
    draw();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation.value = target;
      draw();
      spinning.value = false;
      onSpinEnd(list[winnerIndex]);
    }
  }
  requestAnimationFrame(frame);
}

// 选项变化时重绘（非旋转中）
watch(items, () => {
  if (!spinning.value) {
    void nextTick(() => draw());
  }
}, { deep: true });

onMounted(() => {
  loadFromUrl();
  void nextTick(() => draw());
});
</script>

<template>
  <div>
    <ToolHeader
      title="转盘抽奖"
      description="自定义选项，旋转转盘随机抽取，支持权重、不重复抽取与配置分享"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="flex flex-col gap-4">
          <!-- 选项列表 -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[0.8125rem] text-muted">选项（{{ items.length }}/{{ MAX_ITEMS }}）</span>
              <button
                class="text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0"
                @click="addItem"
              >
                + 添加选项
              </button>
            </div>
            <!-- 列标题：对齐下方输入框 -->
            <div v-if="items.length > 0" class="flex items-center gap-2 text-[0.75rem] text-muted">
              <span class="flex-1 min-w-0">选项名称</span>
              <span class="w-16 text-center">权重</span>
              <span class="shrink-0 w-7"></span>
            </div>
            <div
              v-for="(item, index) in items"
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="item.text"
                type="text"
                placeholder="选项名称"
                class="flex-1 min-w-0 px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
              />
              <input
                v-model.number="item.weight"
                type="number"
                min="1"
                step="1"
                title="权重"
                class="w-16 px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
                @blur="normalizeItemWeight(index)"
              />
              <button
                class="shrink-0 px-2 py-1.5 text-muted hover:text-text cursor-pointer bg-transparent border-0"
                title="删除"
                @click="removeItem(index)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- 批量导入 -->
          <div class="flex flex-col gap-2">
            <span class="text-[0.8125rem] text-muted">批量导入（每行一个，格式：选项名,权重）</span>
            <textarea
              v-model="batchText"
              rows="4"
              placeholder="每行一个选项，逗号后可选填权重（默认 1）&#10;一等奖,1&#10;二等奖,3&#10;谢谢参与"
              class="w-full px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-mono resize-y focus:outline-none focus:border-accent"
            ></textarea>
            <button
              class="self-start px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
              @click="importBatch"
            >
              导入
            </button>
          </div>

          <!-- 不重复抽取开关 -->
          <ToggleSwitch v-model="noRepeat" label="不重复抽取" description="中奖后从转盘移除" />

          <!-- 已中奖列表 -->
          <div v-if="noRepeat && wonItems.length > 0" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[0.8125rem] text-muted">已中奖（{{ wonItems.length }}）</span>
              <button
                class="text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0"
                @click="resetWon"
              >
                全部重置
              </button>
            </div>
            <div
              v-for="(won, index) in wonItems"
              :key="index"
              class="flex items-center justify-between px-2 py-1.5 border border-border rounded-sm bg-card text-sm"
            >
              <span class="truncate">{{ won.text }}</span>
              <button
                class="shrink-0 text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0 ml-2"
                @click="restoreWon(index)"
              >
                恢复
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #actions>
        <div class="flex flex-wrap items-center gap-2 w-full">
          <button
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
            @click="clearAll"
          >
            清空
          </button>
          <button
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
            @click="copyShareLink"
          >
            {{ linkCopied ? '已复制' : '复制分享链接' }}
          </button>
        </div>
      </template>

      <template #output>
        <div class="flex flex-col items-center gap-4">
          <div class="relative" :style="{ width: '320px', height: '320px' }">
            <!-- 指针：悬于转盘上方外侧，尖端指向圆盘顶部边缘，不遮挡盘内文本 -->
            <div
              class="absolute left-1/2 -top-5 -translate-x-1/2 z-10"
              style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 18px solid var(--color-accent, #ef4444);"
            ></div>
            <canvas
              ref="canvasRef"
              class="rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
              :style="{ width: '320px', height: '320px' }"
            ></canvas>
          </div>
          <button
            class="px-8 py-2.5 rounded-sm bg-accent text-white text-sm font-medium cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="spinning || validItems().length < 2"
            @click="spin"
          >
            {{ spinning ? '旋转中…' : '开始' }}
          </button>
          <p v-if="result" class="text-base">
            🎉 中奖：<strong class="text-accent">{{ result }}</strong>
          </p>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
