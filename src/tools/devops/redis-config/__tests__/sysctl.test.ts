/**
 * 系统参数建议单元测试（sysctl.ts）。
 */
import { describe, it, expect } from 'vitest';
import { buildSysctlSuggestions } from '../sysctl';

describe('buildSysctlSuggestions', () => {
  it('默认 conf 值下的四条建议（somaxconn 511 兜底、nofile = maxclients + 32）', () => {
    const items = buildSysctlSuggestions({ tcpBacklog: 511, maxClients: 1000 });
    expect(items).toHaveLength(4);
    expect(items[0].title).toContain('vm.overcommit_memory');
    expect(items[2].command).toContain('net.core.somaxconn=511');
    expect(items[3].command).toContain('ulimit -n 1032');
  });

  it('tcp-backlog 提升后 somaxconn 联动', () => {
    const items = buildSysctlSuggestions({ tcpBacklog: 2048, maxClients: 40000 });
    expect(items[2].command).toContain('net.core.somaxconn=2048');
    expect(items[3].command).toContain('ulimit -n 40032');
  });

  it('每条建议都带命令与中文原因', () => {
    for (const item of buildSysctlSuggestions({ tcpBacklog: 511, maxClients: 1000 })) {
      expect(item.command.trim()).not.toBe('');
      expect(item.reason.trim()).not.toBe('');
    }
  });
});
