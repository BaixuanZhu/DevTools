/**
 * server_id 随机种子（纯本地）：crypto.getRandomValues 提供密码学随机熵，
 * 全程不经网络传输。复制拓扑内多副本同为 1 会互踢重连（经典坑），
 * 打开页面时随机种子一次写入 overrides，用户可手动覆盖。
 */

/**
 * 本地生成合法域内的随机 server_id。
 * 取模到 [1, 4294967295]（0 为保留值，服务器启动会拒绝）：uint32 % 4294967295 + 1，
 * 边界值 1 的取模偏差（约 2/2^32）对唯一性无实际影响。
 * @returns 1 到 4294967295 之间的随机整数
 */
export function generateServerId(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % 4294967295) + 1;
}
