/**
 * 图片批量转换的 ZIP 打包下载模块。
 *
 * 含纯函数文件名去重（可单测）与依赖浏览器 / fflate 的打包下载。
 */
import { zipSync, type Zippable } from 'fflate';

/** 待打包文件 */
export interface ZipFile {
  /** 期望的文件名（含扩展名） */
  name: string;
  /** 文件内容 */
  blob: Blob;
}

/**
 * 拆分文件名为 [基础名, 扩展名]，扩展名含前导点；无扩展名时返回 ['', '']。
 * @param name 文件名
 */
function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * 对文件名列表去重：重复名在扩展名前追加 `-1`/`-2`…，保持原顺序。
 *
 * 追加序号后若仍与已用名冲突，继续递增直到唯一。
 * @param names 原始文件名列表
 * @returns 去重后等长的文件名列表
 */
export function dedupeNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const [base, ext] = splitExt(name);
    let i = 1;
    let candidate = `${base}-${i}${ext}`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${base}-${i}${ext}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/**
 * 将多个文件打包为单个 ZIP 并触发浏览器下载。
 *
 * 文件名经 {@link dedupeNames} 去重，避免 zip 内同名覆盖。
 * @param files 待打包文件
 * @param zipName 下载文件名，默认 `images.zip`
 */
export async function downloadAllAsZip(
  files: ZipFile[],
  zipName = 'images.zip',
): Promise<void> {
  const names = dedupeNames(files.map((f) => f.name));
  const entries: Zippable = {};
  await Promise.all(
    files.map(async (f, i) => {
      entries[names[i]!] = new Uint8Array(await f.blob.arrayBuffer());
    }),
  );
  const zipped = zipSync(entries);
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
