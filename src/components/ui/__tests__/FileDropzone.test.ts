import { describe, it, expect } from 'vitest';
import { validateFile } from '../file-dropzone';

describe('validateFile', () => {
  it('无限制时通过', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(validateFile(file)).toBe('');
  });

  it('accept 为 MIME 通配时匹配', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(validateFile(file, 'image/*')).toBe('');
  });

  it('accept 为具体 MIME 时匹配', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(validateFile(file, 'image/png')).toBe('');
    expect(validateFile(file, 'image/jpeg')).toContain('文件类型不符');
  });

  it('accept 为扩展名时匹配（忽略大小写）', () => {
    const file = new File(['x'], 'a.PNG', { type: 'image/png' });
    expect(validateFile(file, '.png')).toBe('');
    expect(validateFile(file, '.json')).toContain('文件类型不符');
  });

  it('超出 maxSize 时报错', () => {
    const file = new File(['xx'], 'a.png', { type: 'image/png' });
    expect(validateFile(file, undefined, 1)).toContain('文件过大');
  });

  it('maxSize 为 0 时不限制', () => {
    const file = new File(['xx'], 'a.png', { type: 'image/png' });
    expect(validateFile(file, undefined, 0)).toBe('');
  });
});
