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

/** Alpine.js — 轻量级前端响应式框架 */
declare module 'alpinejs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type StoreData = Record<string, any>;

  interface Alpine {
    /** 注册全局 store，传入 data 时创建，不传时获取 */
    store(name: string, data?: StoreData): StoreData;
    /** 启动 Alpine */
    start(): void;
  }

  const Alpine: Alpine;
  export default Alpine;
}

/** 扩展 Window 接口以支持 Alpine.js */
interface Window {
  Alpine: import('alpinejs').Alpine;
}
