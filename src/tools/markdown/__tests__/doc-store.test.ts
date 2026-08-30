/**
 * doc-store 单元测试：多文档草稿持久化的增删改查、排序、标题提取与损坏容错。
 * 全部用例注入内存 Storage，不触碰真实 localStorage。
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import {
  createDoc,
  deleteDoc,
  getDoc,
  listDocs,
  renameDoc,
  saveDoc,
} from '../doc-store';

/** doc-store 的存储键（测试内直连断言，防止键名无意漂移） */
const STORAGE_KEY = 'devtools.markdown.docs.v1';

/**
 * 构造内存 Storage 实现（结构对齐 DOM Storage 接口）。
 *
 * 独立于真实 localStorage 以隔离用例副作用，seed 参数用于预置脏数据验证容错。
 *
 * @param seed 预置键值对
 * @returns 内存 Storage 实例
 */
function createMemoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length(): number {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, String(value));
    },
  };
}

/** 推进假时钟到指定时间戳（doc-store 的时间戳全部取自 Date.now） */
function at(timestamp: number): void {
  vi.setSystemTime(timestamp);
}

/** 把预置文档数组序列化后写入内存存储，用于"已有草稿"场景的用例搭建 */
function seedDocs(storage: Storage, docs: unknown): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

describe('doc-store 多文档草稿持久化', () => {
  let storage: Storage;
  let warnSpy: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    at(1_700_000_000_000);
    storage = createMemoryStorage();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createDoc', () => {
    it('空内容首启创建「未命名文档」并持久化到约定键', () => {
      const doc = createDoc('', storage);

      expect(doc.id).toBeTruthy();
      expect(doc.title).toBe('未命名文档');
      expect(doc.content).toBe('');
      expect(doc.createdAt).toBe(doc.updatedAt);

      const persisted: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '');
      expect(persisted).toEqual([doc]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('带初始内容时自动提取首行标题（首启欢迎文档场景）', () => {
      const doc = createDoc('# 欢迎\n\n这是正文。', storage);
      expect(doc.title).toBe('欢迎');
    });
  });

  describe('listDocs', () => {
    it('空存储（首启）返回空数组且不告警', () => {
      expect(listDocs(storage)).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('按 updatedAt 降序排列（最近编辑的排最前）', () => {
      at(1_000);
      const first = createDoc('# 甲', storage);
      at(2_000);
      const second = createDoc('# 乙', storage);
      at(3_000);
      saveDoc(first.id, '# 甲改', storage);

      const docs = listDocs(storage);
      expect(docs.map((d) => d.id)).toEqual([first.id, second.id]);
      // updatedAt 排序依据：被改过的甲(3000) 晚于 乙(2000)
      expect(docs[0]?.updatedAt).toBe(3_000);
      expect(docs[1]?.updatedAt).toBe(2_000);
    });
  });

  describe('getDoc', () => {
    it('按 ID 命中返回文档副本', () => {
      const created = createDoc('# 标题', storage);
      const fetched = getDoc(created.id, storage);

      expect(fetched).toEqual(created);
      // 返回副本而非内部对象：改动副本不应污染存储
      if (fetched) fetched.title = '被篡改';
      expect(getDoc(created.id, storage)?.title).toBe('标题');
    });

    it('ID 不存在时返回 undefined', () => {
      expect(getDoc('no-such-id', storage)).toBeUndefined();
    });
  });

  describe('saveDoc', () => {
    it('更新内容、重算标题并刷新 updatedAt', () => {
      at(1_000);
      const created = createDoc('# 旧标题', storage);
      at(5_000);

      const saved = saveDoc(created.id, '## 新标题\n新内容', storage);

      expect(saved?.title).toBe('新标题');
      expect(saved?.content).toBe('## 新标题\n新内容');
      expect(saved?.updatedAt).toBe(5_000);
      expect(saved?.createdAt).toBe(1_000);
      expect(listDocs(storage)[0]?.title).toBe('新标题');
    });

    it('新内容无首行标题时回退「未命名文档」', () => {
      const created = createDoc('# 有标题', storage);
      saveDoc(created.id, '正文在前，标题在后\n# 后来才有', storage);
      expect(getDoc(created.id, storage)?.title).toBe('未命名文档');
    });

    it('ID 不存在时不写入并返回 undefined', () => {
      const before = storage.getItem(STORAGE_KEY);
      expect(saveDoc('no-such-id', '任意', storage)).toBeUndefined();
      expect(storage.getItem(STORAGE_KEY)).toBe(before);
    });
  });

  describe('renameDoc', () => {
    it('显式标题覆盖自动标题并刷新 updatedAt', () => {
      at(1_000);
      const created = createDoc('# 自动标题', storage);
      at(2_000);

      const renamed = renameDoc(created.id, '手动命名', storage);

      expect(renamed?.title).toBe('手动命名');
      expect(renamed?.updatedAt).toBe(2_000);
      expect(getDoc(created.id, storage)?.title).toBe('手动命名');
    });

    it('空标题回退「未命名文档」', () => {
      const created = createDoc('# 有标题', storage);
      renameDoc(created.id, '   ', storage);
      expect(getDoc(created.id, storage)?.title).toBe('未命名文档');
    });

    it('ID 不存在时返回 undefined', () => {
      expect(renameDoc('no-such-id', '任意', storage)).toBeUndefined();
    });
  });

  describe('deleteDoc', () => {
    it('删除存在的文档并持久化', () => {
      const a = createDoc('# 甲', storage);
      createDoc('# 乙', storage);

      expect(deleteDoc(a.id, storage)).toBe(true);
      expect(listDocs(storage).map((d) => d.title)).toEqual(['乙']);
    });

    it('ID 不存在时返回 false 且不写入', () => {
      createDoc('# 甲', storage);
      const before = storage.getItem(STORAGE_KEY);

      expect(deleteDoc('no-such-id', storage)).toBe(false);
      expect(storage.getItem(STORAGE_KEY)).toBe(before);
    });
  });

  describe('损坏数据容错', () => {
    it('JSON 解析失败时返回空列表、告警且不抛错', () => {
      storage = createMemoryStorage({ [STORAGE_KEY]: 'not-a-valid-json{{' });

      expect(listDocs(storage)).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain(STORAGE_KEY);
    });

    it('结构不符（元素字段类型错误）时重置为空列表并告警', () => {
      seedDocs(storage, [{ id: 123, title: null, content: 'x', createdAt: 'no', updatedAt: true }]);

      expect(listDocs(storage)).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('结构不符（非数组）时重置为空列表并告警', () => {
      seedDocs(storage, { id: 'x', title: 'x', content: 'x', createdAt: 1, updatedAt: 1 });

      expect(listDocs(storage)).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('损坏数据被重置后，后续写入重建干净状态（编辑器永远可打开）', () => {
      storage = createMemoryStorage({ [STORAGE_KEY]: 'broken{{' });
      expect(listDocs(storage)).toEqual([]);

      const doc = createDoc('# 重生', storage);
      expect(listDocs(storage)).toEqual([doc]);
    });
  });
});
