/**
 * IPv4 地址工具模块
 * 提供解析、格式化、二进制转换、CIDR 验证等基础位运算功能。
 * 所有位运算中间结果使用 `>>> 0` 确保无符号 32 位整数。
 */

/**
 * 将点分十进制 IPv4 字符串解析为无符号 32 位整数
 * @param ip - 点分十进制 IPv4 地址，如 "192.168.1.0"
 * @returns 无符号 32 位整数表示
 * @throws 格式无效时抛出中文错误信息
 */
export function parseIPv4(ip: string): number {
  if (!ip || typeof ip !== 'string') {
    throw new Error('无效的 IPv4 地址：输入不能为空');
  }

  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error('无效的 IPv4 地址格式：必须包含 4 个八位组');
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      throw new Error(`无效的 IPv4 地址格式："${part}" 不是合法的数值`);
    }
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) {
      throw new Error(`无效的 IPv4 地址：八位组值 ${num} 超出范围（0-255）`);
    }
    octets.push(num);
  }

  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

/**
 * 将无符号 32 位整数转换为点分十进制 IPv4 字符串
 * @param num - 无符号 32 位整数
 * @returns 点分十进制字符串，如 "192.168.1.0"
 */
export function formatIPv4(num: number): string {
  return (
    ((num >>> 24) & 0xff) +
    '.' +
    ((num >>> 16) & 0xff) +
    '.' +
    ((num >>> 8) & 0xff) +
    '.' +
    (num & 0xff)
  );
}

/**
 * 将 32 位整数转换为点分二进制字符串
 * @param num - 无符号 32 位整数
 * @returns 点分二进制字符串，如 "11000000.10101000.00000001.00000000"
 */
export function toBinaryDotted(num: number): string {
  const byteToBin = (b: number) => (b & 0xff).toString(2).padStart(8, '0');
  return (
    byteToBin((num >>> 24) & 0xff) +
    '.' +
    byteToBin((num >>> 16) & 0xff) +
    '.' +
    byteToBin((num >>> 8) & 0xff) +
    '.' +
    byteToBin(num & 0xff)
  );
}

/**
 * 将 CIDR 前缀长度（0-32）转换为子网掩码（无符号 32 位整数）
 * @param prefix - 前缀长度，0-32
 * @returns 子网掩码的无符号 32 位整数表示
 */
export function prefixToMask(prefix: number): number {
  if (prefix < 0 || prefix > 32) {
    throw new Error(`CIDR 前缀长度必须在 0-32 之间，当前值：${prefix}`);
  }
  if (prefix === 0) return 0;
  return (~0 << (32 - prefix)) >>> 0;
}

/**
 * 将子网掩码（无符号 32 位整数）转换为 CIDR 前缀长度
 * @param mask - 子网掩码的无符号 32 位整数
 * @returns 前缀长度（0-32），非法掩码返回 -1
 */
export function maskToPrefix(mask: number): number {
  if (mask === 0) return 0;
  // 验证掩码是否为连续的 1 后跟连续的 0
  const inverted = (~mask) >>> 0;
  // inverted + 1 应当是 2 的幂（即只有一个 1）
  const check = (inverted + 1) >>> 0;
  if ((check & (check - 1)) !== 0) return -1;
  // 计算末尾 0 的数量
  let count = 0;
  let m = mask >>> 0;
  while ((m & 1) === 0) {
    count++;
    m = m >>> 1;
  }
  return 32 - count;
}

/**
 * 验证字符串是否为合法的 IPv4 地址
 * @param ip - 待验证的字符串
 * @returns 是否合法
 */
export function isValidIPv4(ip: string): boolean {
  try {
    parseIPv4(ip);
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析 CIDR 表示法字符串
 * @param cidr - CIDR 表示法，如 "192.168.1.0/24"
 * @returns 包含 IP 整数和前缀长度的对象
 * @throws 格式无效时抛出中文错误信息
 */
export function parseCIDR(cidr: string): { ip: number; prefix: number } {
  if (!cidr || typeof cidr !== 'string') {
    throw new Error('无效的 CIDR 格式：输入不能为空');
  }

  const slashIndex = cidr.indexOf('/');
  if (slashIndex === -1) {
    throw new Error('无效的 CIDR 格式：缺少前缀长度（如 /24）');
  }

  const ipStr = cidr.substring(0, slashIndex);
  const prefixStr = cidr.substring(slashIndex + 1);

  if (!/^\d{1,2}$/.test(prefixStr)) {
    throw new Error(`无效的 CIDR 前缀长度："${prefixStr}"`);
  }

  const prefix = parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 32) {
    throw new Error(`CIDR 前缀长度必须在 0-32 之间，当前值：${prefix}`);
  }

  const ip = parseIPv4(ipStr);

  return { ip, prefix };
}
