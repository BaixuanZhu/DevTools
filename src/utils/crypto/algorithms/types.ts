/**
 * 对称加密算法适配器接口。
 * 每种算法实现此接口，由编排器统一调用。
 */
export interface SymmetricAlgorithm {
  /** 唯一标识符，如 'AES-GCM'、'SM4-CBC' */
  readonly id: string;
  /** UI 显示标签 */
  readonly label: string;
  /** IV/nonce 字节长度 */
  readonly ivLength: number;
  /** 可选密钥长度（位），单元素表示固定长度 */
  readonly keyLengths: readonly number[];
  /** 默认密钥长度（位） */
  readonly defaultKeyLength: number;
  /** 是否为 AEAD 认证加密（含认证标签） */
  readonly isAead: boolean;
  /**
   * 加密明文字节。
   * AEAD 算法将认证标签追加到密文末尾。
   * @param plaintext - 明文字节数组
   * @param key - 原始密钥字节
   * @param iv - 初始化向量
   * @returns 密文（AEAD 含 tag）
   */
  encrypt(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;
  /**
   * 解密密文字节。
   * AEAD 算法的输入密文末尾包含认证标签，认证失败时抛出异常。
   * @param ciphertext - 密文字节（AEAD 含 tag）
   * @param key - 原始密钥字节
   * @param iv - 初始化向量
   * @returns 明文字节
   */
  decrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;
}

/** 所有支持的算法 ID */
export type AlgorithmId =
  | 'AES-GCM'
  | 'AES-CBC'
  | 'AES-CTR'
  | 'SM4-CBC'
  | 'ChaCha20-Poly1305'
  | 'DES-CBC'
  | '3DES-CBC';
