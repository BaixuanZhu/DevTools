/**
 * docker run → docker compose 转换器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertRunToCompose } from '../run-to-compose';

describe('convertRunToCompose', () => {
  it('转换最小 docker run 命令', () => {
    const result = convertRunToCompose('docker run nginx:latest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('services:');
    expect(result.result).toContain('image: nginx:latest');
    expect(result.unsupportedCount).toBe(0);
  });

  it('转换完整示例命令', () => {
    const result = convertRunToCompose(
      'docker run -d --name my-nginx -p 8080:80 -v /host/path:/usr/share/nginx/html:ro --restart unless-stopped -e NGINX_HOST=example.com nginx:latest',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('container_name: my-nginx');
    expect(result.result).toContain('image: nginx:latest');
    expect(result.result).toContain('- "8080:80"');
    expect(result.result).toContain('- /host/path:/usr/share/nginx/html:ro');
    expect(result.result).toContain('restart: unless-stopped');
    expect(result.result).toContain('NGINX_HOST: example.com');
  });

  it('空输入返回中文错误', () => {
    const result = convertRunToCompose('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('请输入 docker run 命令');
  });

  it('非 docker 命令返回错误', () => {
    const result = convertRunToCompose('kubectl run nginx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('docker');
  });

  it('不包含 run 子命令返回错误', () => {
    const result = convertRunToCompose('docker ps');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('docker run');
  });

  it('不支持的 flag 以注释保留', () => {
    const result = convertRunToCompose('docker run --cgroupns=host nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('# ⚠️ 不支持: --cgroupns=host');
    expect(result.unsupportedCount).toBe(1);
  });

  it('引号未闭合返回精确错误位置', () => {
    const result = convertRunToCompose('docker run -e "KEY=value nginx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('引号未闭合');
  });
});
