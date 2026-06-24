import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadTextFile } from '../download';

describe('downloadTextFile', () => {
  beforeEach(() => {
    const anchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('设置文件名并触发点击，随后释放 objectURL', () => {
    downloadTextFile('robots.txt', 'User-agent: *');

    const doc = document as unknown as { createElement: ReturnType<typeof vi.fn> };
    const a = doc.createElement.mock.results[0].value as {
      href: string; download: string; click: ReturnType<typeof vi.fn>;
    };
    expect(a.download).toBe('robots.txt');
    expect(a.href).toBe('blob:mock');
    expect(a.click).toHaveBeenCalledOnce();

    const url = URL as unknown as { revokeObjectURL: ReturnType<typeof vi.fn> };
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
