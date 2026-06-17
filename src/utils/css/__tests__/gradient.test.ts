/**
 * CSS 渐变生成单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  clampPosition,
  normalizeAngle,
  isValidColor,
  sortStops,
  buildGradientCss,
  insertStop,
  removeStop,
  type GradientOptions,
  type ColorStop,
} from '../gradient';

describe('clampPosition', () => {
  it('钳制到 0–100', () => {
    expect(clampPosition(-5)).toBe(0);
    expect(clampPosition(50)).toBe(50);
    expect(clampPosition(150)).toBe(100);
  });
});

describe('normalizeAngle', () => {
  it('归一化到 0–360', () => {
    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
  });
});

describe('isValidColor', () => {
  it('有效颜色', () => {
    expect(isValidColor('#ff0000')).toBe(true);
    expect(isValidColor('#f00')).toBe(true);
    expect(isValidColor('rgb(255, 0, 0)')).toBe(true);
    expect(isValidColor('hsl(0, 100%, 50%)')).toBe(true);
  });

  it('无效颜色', () => {
    expect(isValidColor('')).toBe(false);
    expect(isValidColor('red')).toBe(false);
    expect(isValidColor('#12345')).toBe(false);
  });
});

describe('sortStops', () => {
  it('按 position 升序', () => {
    const stops: ColorStop[] = [
      { id: '2', color: '#00f', position: 100 },
      { id: '1', color: '#f00', position: 0 },
    ];
    const sorted = sortStops(stops);
    expect(sorted[0].id).toBe('1');
    expect(sorted[1].id).toBe('2');
  });
});

describe('buildGradientCss', () => {
  it('线性渐变', () => {
    const options: GradientOptions = {
      type: 'linear',
      angle: 90,
      centerX: 50,
      centerY: 50,
      shape: 'ellipse',
      stops: [
        { id: '1', color: '#ff0000', position: 0 },
        { id: '2', color: '#0000ff', position: 100 },
      ],
    };
    expect(buildGradientCss(options)).toBe('linear-gradient(90deg, #ff0000, #0000ff)');
  });

  it('径向渐变', () => {
    const options: GradientOptions = {
      type: 'radial',
      angle: 0,
      centerX: 50,
      centerY: 50,
      shape: 'circle',
      stops: [
        { id: '1', color: '#ff0000', position: 0 },
        { id: '2', color: '#0000ff', position: 100 },
      ],
    };
    expect(buildGradientCss(options)).toBe('radial-gradient(circle at 50.0% 50.0%, #ff0000, #0000ff)');
  });

  it('圆锥渐变', () => {
    const options: GradientOptions = {
      type: 'conic',
      angle: 0,
      centerX: 50,
      centerY: 50,
      shape: 'ellipse',
      stops: [
        { id: '1', color: '#ff0000', position: 0 },
        { id: '2', color: '#0000ff', position: 100 },
      ],
    };
    expect(buildGradientCss(options)).toBe('conic-gradient(from 0deg at 50.0% 50.0%, #ff0000, #0000ff)');
  });
});

describe('insertStop', () => {
  it('在指定位置插入新色标', () => {
    const stops: ColorStop[] = [
      { id: '1', color: '#f00', position: 0 },
      { id: '2', color: '#00f', position: 100 },
    ];
    const result = insertStop(stops, 50);
    expect(result).toHaveLength(3);
    expect(result[1].position).toBe(50);
  });
});

describe('removeStop', () => {
  it('删除指定色标', () => {
    const stops: ColorStop[] = [
      { id: '1', color: '#f00', position: 0 },
      { id: '2', color: '#00f', position: 100 },
      { id: '3', color: '#0f0', position: 50 },
    ];
    const result = removeStop(stops, '3');
    expect(result).toHaveLength(2);
  });

  it('至少保留 2 个色标', () => {
    const stops: ColorStop[] = [
      { id: '1', color: '#f00', position: 0 },
      { id: '2', color: '#00f', position: 100 },
    ];
    const result = removeStop(stops, '1');
    expect(result).toHaveLength(2);
  });
});
