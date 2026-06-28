/**
 * docker run 命令生成器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { generateDockerRunCommand, escapeShellArg } from '../generate-run-command';
import type { FormState } from '../generate-run-command';

function createState(overrides: Partial<FormState> = {}): FormState {
  return {
    image: 'nginx',
    tag: 'latest',
    name: '',
    ports: [],
    envs: [],
    volumes: [],
    workdir: '',
    restart: '',
    network: '',
    detach: false,
    interactive: false,
    tty: false,
    rm: false,
    extraArgs: '',
    ...overrides,
  };
}

describe('generateDockerRunCommand', () => {
  it('最小命令只包含镜像名和默认 latest 标签', () => {
    expect(generateDockerRunCommand(createState())).toBe('docker run nginx:latest');
  });

  it('自定义标签', () => {
    expect(generateDockerRunCommand(createState({ tag: '1.25' }))).toBe('docker run nginx:1.25');
  });

  it('后台运行与自动删除', () => {
    const state = createState({ detach: true, rm: true });
    expect(generateDockerRunCommand(state)).toBe('docker run -d --rm nginx:latest');
  });

  it('容器名称', () => {
    expect(generateDockerRunCommand(createState({ name: 'my-nginx' }))).toBe(
      'docker run --name my-nginx nginx:latest',
    );
  });

  it('端口映射', () => {
    const state = createState({
      ports: [
        { host: '8080', container: '80', protocol: 'tcp' },
        { host: '8443', container: '443', protocol: 'tcp' },
      ],
    });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -p 8080:80/tcp -p 8443:443/tcp nginx:latest',
    );
  });

  it('环境变量', () => {
    const state = createState({ envs: [{ key: 'NODE_ENV', value: 'production' }] });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -e NODE_ENV=production nginx:latest',
    );
  });

  it('环境变量值含空格时使用单引号包裹', () => {
    const state = createState({ envs: [{ key: 'GREETING', value: 'hello world' }] });
    expect(generateDockerRunCommand(state)).toBe(
      "docker run -e GREETING='hello world' nginx:latest",
    );
  });

  it('挂载卷', () => {
    const state = createState({
      volumes: [{ host: '/host/data', container: '/data', mode: 'ro' }],
    });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -v /host/data:/data:ro nginx:latest',
    );
  });

  it('完整示例按固定顺序输出', () => {
    const state = createState({
      image: 'nginx',
      tag: 'latest',
      name: 'my-nginx',
      detach: true,
      rm: true,
      restart: 'unless-stopped',
      network: 'bridge',
      workdir: '/app',
      ports: [{ host: '8080', container: '80', protocol: 'tcp' }],
      envs: [{ key: 'NGINX_HOST', value: 'example.com' }],
      volumes: [{ host: '/host/html', container: '/usr/share/nginx/html', mode: 'ro' }],
      extraArgs: '',
    });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -d --rm --name my-nginx --restart unless-stopped --network bridge -p 8080:80/tcp -e NGINX_HOST=example.com -v /host/html:/usr/share/nginx/html:ro -w /app nginx:latest',
    );
  });

  it('镜像名为空时返回空字符串', () => {
    expect(generateDockerRunCommand(createState({ image: '' }))).toBe('');
  });

  it('交互式终端 it', () => {
    expect(generateDockerRunCommand(createState({ interactive: true, tty: true }))).toBe(
      'docker run -it nginx:latest',
    );
  });

  it('仅交互模式 -i', () => {
    expect(generateDockerRunCommand(createState({ interactive: true, tty: false }))).toBe(
      'docker run -i nginx:latest',
    );
  });

  it('仅伪终端 -t', () => {
    expect(generateDockerRunCommand(createState({ interactive: false, tty: true }))).toBe(
      'docker run -t nginx:latest',
    );
  });

  it('额外参数追加在镜像名之后', () => {
    expect(generateDockerRunCommand(createState({ extraArgs: 'bash' }))).toBe(
      'docker run nginx:latest bash',
    );
  });
});

describe('escapeShellArg', () => {
  it('空字符串返回单引号对', () => {
    expect(escapeShellArg('')).toBe("''");
  });

  it('无特殊字符不添加引号', () => {
    expect(escapeShellArg('nginx')).toBe('nginx');
  });

  it('包含空格用单引号包裹', () => {
    expect(escapeShellArg('hello world')).toBe("'hello world'");
  });

  it('包含单引号时转义', () => {
    expect(escapeShellArg("it's ok")).toBe("'it'\\''s ok'");
  });
});
