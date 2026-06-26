import { describe, it, expect } from 'vitest';
import { dedupeNames } from '../zip-download';

describe('dedupeNames', () => {
  it('保持不重复的名字原样', () => {
    expect(dedupeNames(['a.png', 'b.jpg'])).toEqual(['a.png', 'b.jpg']);
  });

  it('对重复名字在扩展名前追加序号', () => {
    expect(dedupeNames(['a.png', 'a.png', 'a.png'])).toEqual([
      'a.png',
      'a-1.png',
      'a-2.png',
    ]);
  });

  it('处理无扩展名的文件', () => {
    expect(dedupeNames(['img', 'img'])).toEqual(['img', 'img-1']);
  });

  it('追加序号后若仍冲突则继续递增', () => {
    expect(dedupeNames(['a.png', 'a-1.png', 'a.png'])).toEqual([
      'a.png',
      'a-1.png',
      'a-2.png',
    ]);
  });
});
