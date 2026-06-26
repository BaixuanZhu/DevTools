import { describe, it, expect } from 'vitest';
import { normalizeWeight, pickWeightedIndex, computeSectors, computeTargetRotation, POINTER_DEG, encodeShare, decodeShare, parseBatch, sliceColor, DEFAULT_ITEMS } from '../wheel';

describe('normalizeWeight', () => {
  it('保留正有限值', () => {
    expect(normalizeWeight(3)).toBe(3);
    expect(normalizeWeight(0.5)).toBe(0.5);
  });
  it('非正或非有限回退为 1', () => {
    expect(normalizeWeight(0)).toBe(1);
    expect(normalizeWeight(-2)).toBe(1);
    expect(normalizeWeight(NaN)).toBe(1);
    expect(normalizeWeight(Infinity)).toBe(1);
  });
});

describe('pickWeightedIndex', () => {
  it('按前缀和命中对应下标', () => {
    // weights [1,1,2] 总和 4；落点用固定 rng 序列
    const seq = [0.0, 0.24, 0.49, 0.99];
    let i = 0;
    const rng = () => seq[i++];
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(0); // 0.0*4=0  -> idx0 [0,1)
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(0); // 0.24*4=0.96 -> idx0
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(1); // 0.49*4=1.96 -> idx1 [1,2)
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(2); // 0.99*4=3.96 -> idx2 [2,4)
  });
  it('权重不等时高权重命中更频繁', () => {
    const weights = [1, 9];
    let n = 0;
    const rng = () => (n++ % 10) / 10; // 0,0.1,...,0.9
    let high = 0;
    for (let k = 0; k < 10; k++) {
      if (pickWeightedIndex(weights, rng) === 1) high++;
    }
    expect(high).toBe(9); // 总和10，仅落点0.0命中idx0，其余命中idx1
  });
});

describe('computeSectors', () => {
  it('等权时均分 360 度', () => {
    const s = computeSectors([
      { text: 'a', weight: 1 },
      { text: 'b', weight: 1 },
      { text: 'c', weight: 1 },
      { text: 'd', weight: 1 },
    ]);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ startDeg: 0, endDeg: 90, midDeg: 45 });
    expect(s[3].endDeg).toBeCloseTo(360);
  });
  it('面积正比于权重', () => {
    const s = computeSectors([
      { text: 'a', weight: 1 },
      { text: 'b', weight: 3 },
    ]);
    expect(s[0].endDeg).toBeCloseTo(90);
    expect(s[1].startDeg).toBeCloseTo(90);
    expect(s[1].endDeg).toBeCloseTo(360);
  });
  it('空数组返回空', () => {
    expect(computeSectors([])).toEqual([]);
  });
});

describe('computeTargetRotation', () => {
  it('最终角使中奖中线落在指针处', () => {
    const final = computeTargetRotation(0, 90, 2);
    // 中线90 + 最终rotation ≡ POINTER_DEG (mod 360)
    expect(((90 + final) % 360 + 360) % 360).toBeCloseTo(POINTER_DEG);
  });
  it('叠加额外整圈且大于当前角', () => {
    const final = computeTargetRotation(0, 90, 2);
    expect(final).toBeGreaterThanOrEqual(2 * 360);
  });
  it('从非零当前角也单调向前', () => {
    const final = computeTargetRotation(400, 0, 3);
    expect(final).toBeGreaterThan(400);
    expect(((0 + final) % 360 + 360) % 360).toBeCloseTo(POINTER_DEG);
  });
});

describe('encodeShare / decodeShare', () => {
  it('全为权重1时往返一致（含中文）', () => {
    const items = [
      { text: '一等奖', weight: 1 },
      { text: '谢谢参与', weight: 1 },
    ];
    expect(decodeShare(encodeShare(items))).toEqual(items);
  });
  it('含非1权重时往返一致', () => {
    const items = [
      { text: 'A', weight: 3 },
      { text: 'B', weight: 1 },
    ];
    expect(decodeShare(encodeShare(items))).toEqual(items);
  });
  it('编码串为 URL-safe（仅含 A-Za-z0-9_-）', () => {
    const s = encodeShare([{ text: '中文🎡+/=测试', weight: 1 }]);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('坏输入抛错', () => {
    expect(() => decodeShare('!!!not-base64!!!')).toThrow();
    expect(() => decodeShare('')).toThrow();
  });
});

describe('parseBatch', () => {
  it('按行解析并忽略空行/首尾空白', () => {
    expect(parseBatch(' 苹果 \n\n香蕉\n  \n橙子')).toEqual([
      { text: '苹果', weight: 1 },
      { text: '香蕉', weight: 1 },
      { text: '橙子', weight: 1 },
    ]);
  });
  it('去重保留首次出现', () => {
    expect(parseBatch('A\nB\nA')).toEqual([
      { text: 'A', weight: 1 },
      { text: 'B', weight: 1 },
    ]);
  });
  it('超过上限截断', () => {
    const many = Array.from({ length: 60 }, (_, i) => `x${i}`).join('\n');
    expect(parseBatch(many)).toHaveLength(50);
  });
});

describe('sliceColor', () => {
  it('返回合法 hsl 字符串且随下标变化', () => {
    expect(sliceColor(0, 4)).toMatch(/^hsl\(/);
    expect(sliceColor(0, 4)).not.toBe(sliceColor(1, 4));
  });
});

describe('DEFAULT_ITEMS', () => {
  it('提供至少 2 个默认选项', () => {
    expect(DEFAULT_ITEMS.length).toBeGreaterThanOrEqual(2);
  });
});
