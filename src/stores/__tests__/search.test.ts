import { describe, it, expect, beforeEach } from 'vitest';
import { searchStore, filterTools } from '../search';
import type { ToolMeta } from '../../data/tools';

const tools: ToolMeta[] = [
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: '编码与解码 Base64 字符串',
    seoDescription: '',
    category: '文本与编码',
    icon: '🔐',
    path: '/encoding/base64',
    keywords: ['base64', '编码'],
    relatedToolIds: [],
  },
  {
    id: 'hash',
    name: '哈希生成器',
    description: 'MD5 SHA 哈希计算',
    seoDescription: '',
    category: '加密与安全',
    icon: '#️⃣',
    path: '/crypto/hash',
    keywords: ['md5', 'sha256'],
    relatedToolIds: [],
  },
];

describe('filterTools', () => {
  it('query 为空返回 null（不筛选）', () => {
    expect(filterTools(tools, '')).toBeNull();
    expect(filterTools(tools, '   ')).toBeNull();
  });

  it('按 name 匹配（大小写无关）', () => {
    const ids = filterTools(tools, 'BASE64');
    expect(ids).not.toBeNull();
    expect(ids!.has('base64')).toBe(true);
    expect(ids!.has('hash')).toBe(false);
  });

  it('按 description 匹配', () => {
    const ids = filterTools(tools, '哈希计算');
    expect(ids!.has('hash')).toBe(true);
  });

  it('按 keywords 匹配', () => {
    const ids = filterTools(tools, 'sha256');
    expect(ids!.has('hash')).toBe(true);
  });

  it('无匹配返回空集合（非 null）', () => {
    const ids = filterTools(tools, '不存在的工具');
    expect(ids).not.toBeNull();
    expect(ids!.size).toBe(0);
  });
});

describe('searchStore', () => {
  beforeEach(() => {
    searchStore.clear();
  });

  it('setQuery / clear', () => {
    expect(searchStore.query.value).toBe('');
    searchStore.setQuery('base64');
    expect(searchStore.query.value).toBe('base64');
    searchStore.clear();
    expect(searchStore.query.value).toBe('');
  });
});
