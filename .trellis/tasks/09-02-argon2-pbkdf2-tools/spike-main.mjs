// spike: hash-wasm argon2 可用性/向量/耗时 + PBKDF2 双实现交叉验证
import { argon2id, argon2i, argon2d, argon2Verify } from 'hash-wasm';
import { webcrypto } from 'node:crypto';
import nodeCrypto from 'node:crypto';

const enc = (s) => new TextEncoder().encode(s);

// ---------- argon2：候选参考向量（记忆值，实测判定）----------
// 来源印象：多库测试文件常见 argon2i v=19 m=65536 t=2 p=1 salt='somesalt' password='password'
const cand = await argon2i({ password: 'password', salt: 'somesalt', iterations: 2, parallelism: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });
console.log('[vector?] argon2i(password/somesalt,m=65536,t=2,p=1):', cand);

// ---------- roundtrip：三种类型 hash→verify ----------
const params = { iterations: 3, parallelism: 4, memorySize: 65536, hashLength: 32, outputType: 'encoded' };
for (const [name, fn] of [['argon2id', argon2id], ['argon2i', argon2i], ['argon2d', argon2d]]) {
  const h = await fn({ ...params, password: 'DevTools@2026', salt: 'somesalt12345678' });
  const ok = await argon2Verify({ password: 'DevTools@2026', hash: h });
  const bad = await argon2Verify({ password: 'wrong', hash: h });
  console.log(`[roundtrip] ${name}: verify-ok=${ok} verify-bad=${bad} hash=${h.slice(0, 40)}...`);
}

// 篡改哈希尾部 → verify 必须为 false（不能 throw）
const tampered = (await argon2id({ ...params, password: 'DevTools@2026', salt: 'somesalt12345678' })).slice(0, -4) + 'AAAA';
try {
  console.log('[tampered] verify =', await argon2Verify({ password: 'DevTools@2026', hash: tampered }));
} catch (e) {
  console.log('[tampered] THROW:', e.message);
}

// v=16 老版本哈希 verify 行为（手造 v=16 串替换）
const v13 = (await argon2id({ ...params, password: 'DevTools@2026', salt: 'somesalt12345678' })).replace('v=19', 'v=16');
try {
  console.log('[v16] verify =', await argon2Verify({ password: 'DevTools@2026', hash: v13 }));
} catch (e) {
  console.log('[v16] THROW:', e.message);
}

// ---------- 耗时实测（node WASM，浏览器同量级）----------
for (const [label, p] of [
  ['m=65536,t=3,p=4 (RFC9106 二档)', { iterations: 3, parallelism: 4, memorySize: 65536 }],
  ['m=65536,t=3,p=1', { iterations: 3, parallelism: 1, memorySize: 65536 }],
  ['m=19456,t=2,p=1 (OWASP 最低档)', { iterations: 2, parallelism: 1, memorySize: 19456 }],
]) {
  const t0 = performance.now();
  await argon2id({ ...p, password: 'DevTools@2026', salt: 'somesalt12345678', hashLength: 32, outputType: 'encoded' });
  console.log(`[timing] ${label}: ${(performance.now() - t0).toFixed(0)}ms`);
}

// ---------- PBKDF2：subtle vs node pbkdf2Sync 双实现交叉 ----------
const subtle = webcrypto.subtle;
async function pbkdf2Subtle(prf, pw, salt, iters, dkLen) {
  const key = await subtle.importKey('raw', enc(pw), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: prf, salt: enc(salt), iterations: iters }, key, dkLen * 8);
  return Buffer.from(bits).toString('hex');
}
const cases = [
  ['SHA-1', 'password', 'salt', 1, 20, '0c60c80f961f0e71f3a9b524af6012062fe037a6'], // RFC 6070 case 1
  ['SHA-1', 'password', 'salt', 4096, 20, '4b007901b765489abead49d926f721d065a429c1'], // RFC 6070 case 2
  ['SHA-256', 'password', 'salt', 1, 32, '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'],
  ['SHA-256', 'password', 'salt', 2, 32, 'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43'],
  ['SHA-512', 'passwordPASSWORDpassword', 'saltSALTsaltSALTsaltSALTsaltSALTsalt', 4096, 40, null],
];
for (const [prf, pw, salt, iters, dkLen, expect] of cases) {
  const s = await pbkdf2Subtle(prf, pw, salt, iters, dkLen);
  const n = nodeCrypto.pbkdf2Sync(pw, salt, iters, dkLen, prf.replace('-', '').toLowerCase()).toString('hex');
  console.log(`[pbkdf2] ${prf} c=${iters}: subtle===node ${s === n} ${expect ? `rfc-match ${s === expect} ${s.slice(0, 16)}...` : s.slice(0, 16) + '...'}`);
}

// ---------- Django 格式向量生成（测试固化用，低迭代快速）----------
const djPw = 'DevTools@2026';
const djSaltRaw = Buffer.from('some-salt-16byte', 'utf8');
const djHash = nodeCrypto.pbkdf2Sync(djPw, djSaltRaw, 100, 32, 'sha256');
const djB64 = Buffer.from(djSaltRaw).toString('base64');
console.log('[django-vector]', `pbkdf2_sha256$100$${djB64}$${djHash.toString('base64')}`);
// 用 subtle 复算核对同一向量
const dk = await pbkdf2Subtle('SHA-256', djPw, 'some-salt-16byte', 100, 32);
console.log('[django-vector] subtle cross:', dk === djHash.toString('hex'));

// subtle 600000 迭代耗时
const t1 = performance.now();
await pbkdf2Subtle('SHA-256', 'password', 'salt', 600000, 32);
console.log(`[timing] pbkdf2 sha256 c=600000: ${(performance.now() - t1).toFixed(0)}ms`);
