/**
 * 第三方模块的类型声明补充
 * 用于为没有自带类型声明的依赖提供类型信息
 */

/** des.js — DES / 3DES 加密库 */
declare module 'des.js' {
  interface Cipher {
    update(data: Uint8Array): number[];
    final(): number[];
  }

  interface CipherOptions {
    type: 'encrypt' | 'decrypt';
    key: Uint8Array;
    iv: Uint8Array;
  }

  interface CipherFactory {
    create(options: CipherOptions): Cipher;
  }

  interface Mode {
    instantiate(Algorithm: new (...args: unknown[]) => unknown): CipherFactory;
  }

  class DES {}
  class EDE {}

  export const CBC: Mode;
  export { DES, EDE };
}
