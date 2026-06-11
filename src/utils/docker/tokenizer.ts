/**
 * Shell 命令分词器。
 *
 * 将 docker run 命令字符串按 shell 规则拆分为 token 数组。
 * 使用状态机实现，支持单引号、双引号、转义字符和续行符。
 *
 * 实现要点：
 * - DEFAULT：普通字符直接拼接，遇到空白结束当前 token
 * - SINGLE_Q：单引号内原样保留字符，不处理转义
 * - DOUBLE_Q：双引号内处理 `\\` 开头的转义序列
 * - ESCAPE：处理双引号内转义字符（如 \\"、\\$、\\`、\\\\ 和续行）
 */

import type { Token, TokenizeResult } from './types';

type State = 'DEFAULT' | 'SINGLE_Q' | 'DOUBLE_Q' | 'ESCAPE';

/**
 * 将 shell 命令字符串分词为 token 数组。
 *
 * @param input - 完整的 shell 命令字符串
 * @returns 分词结果。成功返回 token 数组，失败返回错误描述。
 */
export function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  let current = '';
  let tokenStart = 0;
  let quoteStart = -1;
  let state: State = 'DEFAULT';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    switch (state) {
      case 'DEFAULT': {
        if (ch === "'") {
          if (current === '') {
            tokenStart = i;
          }
          quoteStart = i;
          state = 'SINGLE_Q';
          i++;
        } else if (ch === '"') {
          if (current === '') {
            tokenStart = i;
          }
          quoteStart = i;
          state = 'DOUBLE_Q';
          i++;
        } else if (ch === '\\') {
          if (i + 1 < input.length && input[i + 1] === '\n') {
            // 续行：丢弃反斜杠和换行
            i += 2;
          } else {
            if (current === '') {
              tokenStart = i;
            }
            if (i + 1 < input.length) {
              current += input[i + 1];
              i += 2;
            } else {
              current += ch;
              i++;
            }
          }
        } else if (/\s/.test(ch)) {
          if (current !== '') {
            tokens.push({ value: current, start: tokenStart, end: i });
            current = '';
          }
          i++;
        } else {
          if (current === '') {
            tokenStart = i;
          }
          current += ch;
          i++;
        }
        break;
      }

      case 'SINGLE_Q': {
        if (ch === "'") {
          state = 'DEFAULT';
          i++;
          if (current === '') {
            tokens.push({ value: '', start: tokenStart, end: i });
          }
        } else {
          current += ch;
          i++;
        }
        break;
      }

      case 'DOUBLE_Q': {
        if (ch === '\\') {
          state = 'ESCAPE';
          i++;
        } else if (ch === '"') {
          state = 'DEFAULT';
          i++;
          if (current === '') {
            tokens.push({ value: '', start: tokenStart, end: i });
          }
        } else {
          current += ch;
          i++;
        }
        break;
      }

      case 'ESCAPE': {
        // 双引号内反斜杠后的特殊字符才去掉反斜杠
        if (ch === '$' || ch === '`' || ch === '"' || ch === '\\') {
          current += ch;
        } else if (ch === '\n') {
          // 双引号内续行：两者都丢弃
        } else {
          // 其他字符保留反斜杠
          current += '\\' + ch;
        }
        state = 'DOUBLE_Q';
        i++;
        break;
      }
    }
  }

  if (state === 'SINGLE_Q') {
    return {
      ok: false,
      error: `引号未闭合，位置：第 ${quoteStart + 1} 个字符附近的单引号`,
    };
  }

  if (state === 'DOUBLE_Q' || state === 'ESCAPE') {
    return {
      ok: false,
      error: `引号未闭合，位置：第 ${quoteStart + 1} 个字符附近的双引号`,
    };
  }

  if (current !== '') {
    tokens.push({ value: current, start: tokenStart, end: input.length });
  }

  return { ok: true, tokens };
}
