/**
 * docker compose → docker run 转换器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertComposeToRun } from '../compose-to-run';

const SAMPLE_COMPOSE = `services:
  my-nginx:
    image: nginx:latest
    container_name: my-nginx
    ports:
      - "8080:80"
    volumes:
      - /host/path:/usr/share/nginx/html:ro
    environment:
      NGINX_HOST: example.com
    restart: unless-stopped
`;

describe('convertComposeToRun', () => {
  it('转换基本 compose 配置', () => {
    const result = convertComposeToRun(SAMPLE_COMPOSE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('docker run');
    expect(result.result).toContain('--name my-nginx');
    expect(result.result).toContain('-p 8080:80');
    expect(result.result).toContain('-v /host/path:/usr/share/nginx/html:ro');
    expect(result.result).toContain('-e NGINX_HOST=example.com');
    expect(result.result).toContain('--restart unless-stopped');
    expect(result.result).toContain('nginx:latest');
  });

  it('空输入返回中文错误', () => {
    const result = convertComposeToRun('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('请输入 docker compose 配置');
  });

  it('无 services 返回错误', () => {
    const result = convertComposeToRun('version: "3"');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('services');
  });

  it('services 为空返回错误', () => {
    const result = convertComposeToRun('services: {}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('没有定义任何服务');
  });

  it('YAML 语法错误返回错误信息', () => {
    const result = convertComposeToRun('services: { broken');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('无法映射的字段以注释保留', () => {
    const result = convertComposeToRun(`services:
  app:
    image: nginx
    build: .
    depends_on:
      - db
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('# ⚠️ 无法映射: build');
    expect(result.result).toContain('# ⚠️ 无法映射: depends_on');
  });

  it('多 service 时只转换第一个，其余以注释保留', () => {
    const result = convertComposeToRun(`services:
  web:
    image: nginx
  redis:
    image: redis:7
    ports:
      - "6379:6379"
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('docker run nginx');
    expect(result.result).toContain('# 以下 service 未转换（docker run 仅支持单容器）：');
    expect(result.result).toContain('# - redis');
  });
});
