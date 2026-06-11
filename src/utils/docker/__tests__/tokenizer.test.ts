/**
 * Docker shell 命令分词器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer';

describe('tokenize', () => {
  it('将基本 docker run 命令拆分为 token', () => {
    const result = tokenize('docker run -d --name my-nginx nginx:latest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-d',
      '--name',
      'my-nginx',
      'nginx:latest',
    ]);
  });

  it('忽略多余空白字符', () => {
    const result = tokenize('docker   run   -d   nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual(['docker', 'run', '-d', 'nginx']);
  });

  it('支持单引号包裹的值', () => {
    const result = tokenize("docker run -e 'KEY=value with spaces' nginx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-e',
      'KEY=value with spaces',
      'nginx',
    ]);
  });

  it('支持双引号包裹的值', () => {
    const result = tokenize('docker run -e "KEY=value with spaces" nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-e',
      'KEY=value with spaces',
      'nginx',
    ]);
  });

  it('支持转义双引号', () => {
    const result = tokenize('docker run -e "KEY=\\"quoted\\"" nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-e',
      'KEY="quoted"',
      'nginx',
    ]);
  });

  it('支持 --flag=value 等号格式', () => {
    const result = tokenize('docker run --name=my-nginx nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual(['docker', 'run', '--name=my-nginx', 'nginx']);
  });

  it('支持反斜杠续行', () => {
    const result = tokenize('docker run \\\n  -d \\\n  nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual(['docker', 'run', '-d', 'nginx']);
  });

  it('支持未加引号时的反斜杠转义', () => {
    const result = tokenize('docker run --name=my\\ name nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker', 'run', '--name=my name', 'nginx',
    ]);
  });

  it('记录 token 位置并支持空引号', () => {
    const result = tokenize("docker run --env '' nginx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens[3].value).toBe('');
    expect(result.tokens[3].start).toBe(17);
    expect(result.tokens[3].end).toBe(19);
  });

  it('未闭合单引号返回错误', () => {
    const result = tokenize("docker run -e 'KEY=value nginx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('引号未闭合');
  });

  it('未闭合双引号返回错误', () => {
    const result = tokenize('docker run -e "KEY=value nginx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('引号未闭合');
  });
});
