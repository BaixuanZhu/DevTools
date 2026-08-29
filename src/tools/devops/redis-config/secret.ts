/**
 * 密码生成（纯本地）：crypto.getRandomValues 提供密码学随机熵，
 * 经 btoa 与 base64url 替换输出 URL 安全字符串，全程不经网络传输。
 */

/**
 * 本地生成 24 字符 base64url 随机密码（18 字节 = 144 位熵）。
 * @returns base64url 形态的密码字符串（无 +/= 字符，可直接写入 redis.conf）
 */
export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
