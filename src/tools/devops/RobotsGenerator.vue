<script setup lang="ts">
/**
 * robots.txt 生成器主组件。
 *
 * 左侧表单按 User-agent 分组维护 Allow/Disallow 规则，并提供 AI 爬虫
 * 一键拦截区与 Sitemap 引用区；右侧实时输出标准 robots.txt 文本，
 * 支持复制与下载。规则输入旁常驻通俗规则解释。
 */
import { reactive, ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import { useCopy } from '../../composables/useCopy';
import { downloadTextFile } from '../../utils/shared/download';
import {
  generateRobotsTxt,
  buildAiBlockGroups,
  createAgentGroup,
  createPathRule,
  type AgentGroup,
  type PathRule,
  type RuleType,
} from '../../utils/devops/robots-generator';
import { AI_CRAWLERS } from '../../utils/devops/ai-crawlers';

/** 默认数据：id 用固定字面量，避免 SSR/水合不匹配 */
const groups = reactive<AgentGroup[]>([
  {
    id: 'group-default',
    userAgents: ['*'],
    rules: [{ id: 'rule-default', type: 'disallow', path: '/admin/' }],
  },
]);
const sitemaps = reactive<string[]>([]);
/** 已勾选的 AI 爬虫 User-agent 集合 */
const aiSelected = ref<Set<string>>(new Set());

/** 合并手动组 + AI 拦截组后的 robots 文本 */
const robotsText = computed(() =>
  generateRobotsTxt({
    groups: [...groups, ...buildAiBlockGroups([...aiSelected.value])],
    sitemaps,
  }),
);

/** 新增 UA 为空时使用的临时输入 */
const newSitemap = ref('');

/** 新增规则组 */
function addGroup(): void {
  groups.push(createAgentGroup('*'));
}
/** 删除规则组 */
function removeGroup(id: string): void {
  const idx = groups.findIndex((g) => g.id === id);
  if (idx !== -1) groups.splice(idx, 1);
}
/** 组内新增路径规则 */
function addRule(group: AgentGroup, type: RuleType): void {
  group.rules.push(createPathRule(type, '/'));
}
/** 删除组内某条规则 */
function removeRule(group: AgentGroup, ruleId: string): void {
  const idx = group.rules.findIndex((r) => r.id === ruleId);
  if (idx !== -1) group.rules.splice(idx, 1);
}

/** 切换单个 AI 爬虫拦截 */
function toggleAi(ua: string): void {
  const next = new Set(aiSelected.value);
  if (next.has(ua)) next.delete(ua);
  else next.add(ua);
  aiSelected.value = next;
}
/** 一键拦截 / 解除所有 AI 爬虫 */
const allAiBlocked = computed(
  () => AI_CRAWLERS.length > 0 && aiSelected.value.size === AI_CRAWLERS.length,
);
function toggleAllAi(): void {
  aiSelected.value = allAiBlocked.value
    ? new Set()
    : new Set(AI_CRAWLERS.map((c) => c.userAgent));
}

/** 新增 Sitemap 引用 */
function addSitemap(): void {
  const v = newSitemap.value.trim();
  if (v && !sitemaps.includes(v)) sitemaps.push(v);
  newSitemap.value = '';
}
/** 删除 Sitemap 引用 */
function removeSitemap(idx: number): void {
  sitemaps.splice(idx, 1);
}

const { copy: copyText } = useCopy();
function handleCopy(): void {
  copyText(robotsText.value);
}
function handleDownload(): void {
  downloadTextFile('robots.txt', robotsText.value, 'text/plain;charset=utf-8');
}

/** 清空全部 */
function handleClear(): void {
  groups.splice(0, groups.length);
  sitemaps.splice(0, sitemaps.length);
  aiSelected.value = new Set();
  newSitemap.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="robots.txt 生成器"
      description="按 User-agent 分组添加规则，一键拦截 AI 爬虫，实时生成标准 robots.txt"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入表单 -->
      <template #input>
        <div class="bg-card border border-border rounded-lg p-6 space-y-6">
          <!-- 规则组列表 -->
          <div class="space-y-4">
            <div
              v-for="group in groups"
              :key="group.id"
              class="border border-border rounded-md p-4 space-y-3"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="group.userAgents[0]"
                  type="text"
                  class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                  placeholder="User-agent（* 表示所有爬虫）"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-[0.8125rem] text-error border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="removeGroup(group.id)"
                >删除组</button>
              </div>
              <p class="text-[0.75rem] text-muted m-0">
                <code class="bg-hover px-1 py-0.5 rounded-sm">*</code> 匹配所有搜索引擎爬虫，是站点默认规则
              </p>

              <!-- 该组的路径规则 -->
              <div v-for="rule in group.rules" :key="rule.id" class="flex items-center gap-2">
                <select
                  v-model="rule.type"
                  class="px-2 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
                >
                  <option value="disallow">Disallow</option>
                  <option value="allow">Allow</option>
                </select>
                <input
                  v-model="rule.path"
                  type="text"
                  class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                  placeholder="/private/"
                />
                <button
                  type="button"
                  class="px-2 py-2 text-[0.8125rem] text-muted border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="removeRule(group, rule.id)"
                >✕</button>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-[0.8125rem] border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="addRule(group, 'disallow')"
                >+ Disallow</button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-[0.8125rem] border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="addRule(group, 'allow')"
                >+ Allow</button>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="addGroup"
          >+ 添加规则组</button>

          <!-- AI 爬虫一键拦截 -->
          <div class="border border-border rounded-md p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-text m-0">🤖 AI 爬虫一键拦截</h3>
              <button
                type="button"
                class="text-[0.8125rem] text-accent cursor-pointer bg-transparent border-none"
                @click="toggleAllAi"
              >{{ allAiBlocked ? '全部解除' : '拦截所有' }}</button>
            </div>
            <p class="text-[0.75rem] text-muted m-0">
              勾选即为该爬虫生成 <code class="bg-hover px-1 py-0.5 rounded-sm">Disallow: /</code>，禁止抓取整站
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleSwitch
                v-for="c in AI_CRAWLERS"
                :key="c.userAgent"
                :model-value="aiSelected.has(c.userAgent)"
                :label="`${c.userAgent} · ${c.vendor}`"
                @update:model-value="toggleAi(c.userAgent)"
              />
            </div>
          </div>

          <!-- Sitemap 引用 -->
          <div class="border border-border rounded-md p-4 space-y-2">
            <h3 class="text-sm font-semibold text-text m-0">Sitemap 引用</h3>
            <p class="text-[0.75rem] text-muted m-0">告知搜索引擎你的 sitemap.xml 位置</p>
            <div v-for="(s, idx) in sitemaps" :key="idx" class="flex items-center gap-2">
              <input
                :value="s"
                type="text"
                readonly
                class="flex-1 px-3 py-2 border border-border rounded-sm bg-hover text-text text-sm"
              />
              <button
                type="button"
                class="px-2 py-2 text-[0.8125rem] text-muted border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                @click="removeSitemap(idx)"
              >✕</button>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newSitemap"
                type="text"
                class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                placeholder="https://example.com/sitemap.xml"
                @keydown.enter.prevent="addSitemap"
              />
              <button
                type="button"
                class="px-3 py-2 text-sm border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                @click="addSitemap"
              >添加</button>
            </div>
          </div>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleClear"
          >清空</button>
        </div>
      </template>

      <!-- 输出区 -->
      <template #output>
        <div class="flex justify-end gap-2 mb-2">
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleDownload"
          >下载 robots.txt</button>
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleCopy"
          >复制结果</button>
        </div>
        <CodePanel label="robots.txt" :copy-text="robotsText" show-copy>
          <pre class="w-full p-4 bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap break-all">{{ robotsText }}</pre>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
