// 扫描 dist 全部 HTML 的 <title> 长度（任务 09-01-seo-title-length 验收脚本）。
// 守卫区间 25-60；meta-refresh 重定向页（旧扁平 URL 301 等价物）豁免，其标题会被目标页取代。
import fs from 'node:fs';
import path from 'node:path';

const DIST = new URL('../../../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const MIN = 25, MAX = 60;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });
}

const rows = [];
for (const f of walk(DIST)) {
  const html = fs.readFileSync(f, 'utf8');
  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => m[1].trim());
  const isRedirect = /http-equiv=["']?refresh/i.test(html);
  const title = titles[0] ?? '(无 title)';
  rows.push({
    url: path.relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, ''),
    title,
    len: [...title].length,
    dup: titles.length > 1 ? `x${titles.length}` : '',
    redirect: isRedirect,
  });
}
rows.sort((a, b) => a.len - b.len);

let bad = 0;
const lines = [];
for (const r of rows) {
  const exempt = r.redirect;
  const ok = r.len >= MIN && r.len <= MAX;
  if (!ok && !exempt) bad++;
  lines.push(
    `${String(r.len).padStart(3)} ${r.dup.padEnd(3)} ${exempt ? '[redirect-exempt]' : ok ? '[ok]' : '[BAD!]'.padEnd(17)} ${r.url} | ${r.title}`,
  );
}
lines.push('');
lines.push(`共 ${rows.length} 页；重定向豁免 ${rows.filter((r) => r.redirect).length} 页；非豁免越界 ${bad} 页`);
lines.push(`非豁免长度分布：min=${Math.min(...rows.filter((r) => !r.redirect).map((r) => r.len))} max=${Math.max(...rows.filter((r) => !r.redirect).map((r) => r.len))}`);
console.log(lines.join('\n'));
process.exit(bad ? 1 : 0);
