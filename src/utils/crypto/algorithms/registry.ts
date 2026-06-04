import type { SymmetricAlgorithm, AlgorithmId } from './types';
import { aesGcm, aesCbc, aesCtr } from './aes';
import { chacha20Poly1305Algo } from './chacha20-poly1305';
import { sm4Cbc } from './sm4';
import { desCbc, tripleDesCbc } from './des';

/** 所有已注册算法的映射表 */
export const ALGORITHM_REGISTRY: Readonly<Record<AlgorithmId, SymmetricAlgorithm>> = {
  'AES-GCM': aesGcm,
  'AES-CBC': aesCbc,
  'AES-CTR': aesCtr,
  'ChaCha20-Poly1305': chacha20Poly1305Algo,
  'SM4-CBC': sm4Cbc,
  'DES-CBC': desCbc,
  '3DES-CBC': tripleDesCbc,
};

/**
 * 根据 ID 获取算法适配器
 * @param id - 算法 ID
 * @throws 算法不存在时抛出异常
 */
export function getAlgorithm(id: AlgorithmId): SymmetricAlgorithm {
  const algo = ALGORITHM_REGISTRY[id];
  if (!algo) throw new Error(`不支持的算法: ${id}`);
  return algo;
}

/** 所有算法 ID 列表（用于 UI 枚举） */
export const ALL_ALGORITHM_IDS: readonly AlgorithmId[] = Object.keys(
  ALGORITHM_REGISTRY,
) as readonly AlgorithmId[];
