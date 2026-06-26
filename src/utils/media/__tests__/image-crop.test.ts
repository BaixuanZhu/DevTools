import { describe, it, expect } from 'vitest';
import {
  cropOutputExtension,
  buildCropFileName,
  isCropLossy,
} from '../image-crop';

describe('cropOutputExtension', () => {
  it('image/png → .png', () => {
    expect(cropOutputExtension('image/png')).toBe('.png');
  });

  it('image/jpeg → .jpg', () => {
    expect(cropOutputExtension('image/jpeg')).toBe('.jpg');
  });

  it('image/webp → .webp', () => {
    expect(cropOutputExtension('image/webp')).toBe('.webp');
  });
});

describe('buildCropFileName', () => {
  it('拼接基础名与扩展名', () => {
    expect(buildCropFileName('cropped', '.png')).toBe('cropped.png');
    expect(buildCropFileName('my-image', '.jpg')).toBe('my-image.jpg');
    expect(buildCropFileName('avatar', '.webp')).toBe('avatar.webp');
  });

  it('支持空基础名', () => {
    expect(buildCropFileName('', '.png')).toBe('.png');
  });
});

describe('isCropLossy', () => {
  it('jpeg / webp 为有损', () => {
    expect(isCropLossy('image/jpeg')).toBe(true);
    expect(isCropLossy('image/webp')).toBe(true);
  });

  it('png 为无损', () => {
    expect(isCropLossy('image/png')).toBe(false);
  });
});
