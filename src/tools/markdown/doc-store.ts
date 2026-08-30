/**
 * Markdown 工作台多文档草稿持久化层（markdown 工作台私有数据层）。
 *
 * 职责：以单个 localStorage 键保存文档数组，提供增删改查纯函数；
 * 容错语义——存储内容损坏时重置为空列表并 console.warn，绝不向调用方抛错，
 * 保证编辑器在任何脏数据状态下都能打开。
 * 所有导出函数的末位参数可注入 Storage（默认 localStorage），供测试用内存实现替换，
 * 也可让岛层将来接入 IndexedDB 等后端而不改调用方。
 */

/** 工作台文档数据结构（存储键 `devtools.markdown.docs.v1` 的数组元素） */
export interface MarkdownDoc {
  /** 文档唯一 ID（crypto.randomUUID() 生成） */
  id: string;
  /**
   * 文档标题：随内容自动提取（首行 ATX 标题文本，未找到时为「未命名文档」）。
   * renameDoc 可显式指定，但会被下一次 saveDoc 的自动提取覆盖——UI 层需知晓该语义。
   */
  title: string;
  /** Markdown 正文 */
  content: string;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 最后更新时间戳（毫秒），listDocs 按其降序排列 */
  updatedAt: number;
}

/** localStorage 存储键；v1 后缀为未来 schema 演进（如模板库）预留迁移空间 */
const STORAGE_KEY = 'devtools.markdown.docs.v1';

/** 内容无法提取标题时的兜底文案 */
const UNTITLED_TITLE = '未命名文档';

/** ATX 标题行（行首至多 3 个空格 + 1-6 个 # + 空格 + 文本，与 CommonMark 渲染判定一致） */
const ATX_HEADING_RE = /^\s{0,3}#{1,6}\s+(.+)$/;

/**
 * 从 Markdown 内容提取文档标题。
 *
 * 跳过前导空行后，首个非空行为 ATX 标题时取其文本（去除 # 前缀与首尾空白），
 * 否则回退「未命名文档」——仅认首行而非全文首个标题，避免把正文深处的章节标题当成文档名。
 *
 * @param content Markdown 正文
 * @returns 提取出的标题
 */
function extractTitle(content: string): string {
  const firstNonEmptyLine = content.split('\n').find((line) => line.trim() !== '');
  const heading = firstNonEmptyLine?.match(ATX_HEADING_RE);
  const text = heading?.[1]?.trim() ?? '';
  return text === '' ? UNTITLED_TITLE : text;
}

/**
 * 校验解析结果是否为合法的 MarkdownDoc 数组。
 *
 * 存储内容由历史版本或人工改动可能产生结构漂移，逐字段类型校验可把脏数据
 * 拦在渲染层之外（进入渲染层的对象结构总是可信的）。
 *
 * @param value JSON.parse 的结果
 * @returns 是否通过结构校验
 */
function isValidDocArray(value: unknown): value is MarkdownDoc[] {
  const isMarkdownDoc = (item: unknown): item is MarkdownDoc => {
    if (typeof item !== 'object' || item === null) return false;
    const doc = item as Record<string, unknown>;
    return (
      typeof doc.id === 'string' &&
      typeof doc.title === 'string' &&
      typeof doc.content === 'string' &&
      typeof doc.createdAt === 'number' &&
      typeof doc.updatedAt === 'number'
    );
  };
  return Array.isArray(value) && value.every(isMarkdownDoc);
}

/**
 * 读取并解析存储中的文档数组。
 *
 * 空存储（首次启动）返回空数组；JSON 解析失败或结构不符时重置语义生效——
 * 返回空数组并 console.warn 留痕，不抛错（草稿损坏不应导致编辑器不可用），
 * 后续任何写操作会以干净数组覆盖损坏值。
 *
 * @param storage 注入的存储实现
 * @returns 文档数组（无序，排序由 listDocs 负责）
 */
function readDocs(storage: Storage): MarkdownDoc[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidDocArray(parsed)) return parsed;
    console.warn(`[doc-store] "${STORAGE_KEY}" 内容结构不符，已重置为空列表`);
  } catch {
    console.warn(`[doc-store] "${STORAGE_KEY}" 内容解析失败，已重置为空列表`);
  }
  return [];
}

/**
 * 序列化文档数组并写回存储。
 *
 * @param storage 注入的存储实现
 * @param docs 待持久化的文档数组
 */
function writeDocs(storage: Storage, docs: MarkdownDoc[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

/**
 * 返回文档浅拷贝，防止调用方绕过持久化直接改动内部对象（所有读路径出口统一收敛于此）。
 *
 * @param doc 存储层中的文档对象
 * @returns 可安全交给调用方的副本
 */
function cloneDoc(doc: MarkdownDoc): MarkdownDoc {
  return { ...doc };
}

/**
 * 列出全部文档，按 updatedAt 降序排列（最近编辑的排最前，供侧栏列表直接消费）。
 *
 * @param storage 可注入存储实现，默认 localStorage
 * @returns 文档副本数组
 */
export function listDocs(storage: Storage = globalThis.localStorage): MarkdownDoc[] {
  return readDocs(storage)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(cloneDoc);
}

/**
 * 按 ID 获取单个文档。
 *
 * @param id 文档 ID
 * @param storage 可注入存储实现，默认 localStorage
 * @returns 文档副本；ID 不存在时为 undefined
 */
export function getDoc(
  id: string,
  storage: Storage = globalThis.localStorage,
): MarkdownDoc | undefined {
  const doc = readDocs(storage).find((d) => d.id === id);
  return doc ? cloneDoc(doc) : undefined;
}

/**
 * 创建新文档并持久化。
 *
 * @param initialContent 可选初始内容（如首启欢迎文档），标题随内容自动提取
 * @param storage 可注入存储实现，默认 localStorage
 * @returns 新创建的文档副本
 */
export function createDoc(
  initialContent = '',
  storage: Storage = globalThis.localStorage,
): MarkdownDoc {
  const now = Date.now();
  const doc: MarkdownDoc = {
    id: crypto.randomUUID(),
    title: extractTitle(initialContent),
    content: initialContent,
    createdAt: now,
    updatedAt: now,
  };
  writeDocs(storage, [doc, ...readDocs(storage)]);
  return cloneDoc(doc);
}

/**
 * 保存文档内容：更新正文、按新内容重算标题并刷新 updatedAt。
 *
 * @param id 文档 ID
 * @param content 新的 Markdown 正文
 * @param storage 可注入存储实现，默认 localStorage
 * @returns 更新后的文档副本；ID 不存在时不做任何写入并返回 undefined
 */
export function saveDoc(
  id: string,
  content: string,
  storage: Storage = globalThis.localStorage,
): MarkdownDoc | undefined {
  const docs = readDocs(storage);
  const doc = docs.find((d) => d.id === id);
  if (!doc) return undefined;
  doc.content = content;
  doc.title = extractTitle(content);
  doc.updatedAt = Date.now();
  writeDocs(storage, docs);
  return cloneDoc(doc);
}

/**
 * 重命名文档：显式标题优先于内容推断（空标题回退「未命名文档」），并刷新 updatedAt。
 * 注意标题会在下一次 saveDoc 时被内容自动提取覆盖。
 *
 * @param id 文档 ID
 * @param title 新标题（首尾空白会被去除）
 * @param storage 可注入存储实现，默认 localStorage
 * @returns 更新后的文档副本；ID 不存在时返回 undefined
 */
export function renameDoc(
  id: string,
  title: string,
  storage: Storage = globalThis.localStorage,
): MarkdownDoc | undefined {
  const docs = readDocs(storage);
  const doc = docs.find((d) => d.id === id);
  if (!doc) return undefined;
  const trimmed = title.trim();
  doc.title = trimmed === '' ? UNTITLED_TITLE : trimmed;
  doc.updatedAt = Date.now();
  writeDocs(storage, docs);
  return cloneDoc(doc);
}

/**
 * 删除文档。
 *
 * @param id 文档 ID
 * @param storage 可注入存储实现，默认 localStorage
 * @returns 是否实际删除（ID 不存在时为 false，不触发写入）
 */
export function deleteDoc(id: string, storage: Storage = globalThis.localStorage): boolean {
  const docs = readDocs(storage);
  const next = docs.filter((d) => d.id !== id);
  if (next.length === docs.length) return false;
  writeDocs(storage, next);
  return true;
}
