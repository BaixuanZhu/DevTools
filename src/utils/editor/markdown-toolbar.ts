/**
 * Markdown 工具栏动作定义模块。
 *
 * 每个动作函数接收 textarea 的选区信息，返回插入后的文本和新光标位置，
 * 供主组件调用以在编辑区插入 Markdown 语法片段。
 */

/** 工具栏动作函数的输入参数 */
export interface TextareaState {
  /** textarea 的当前完整文本 */
  value: string;
  /** 选区起始位置 */
  selectionStart: number;
  /** 选区结束位置 */
  selectionEnd: number;
}

/** 工具栏动作函数的返回结果 */
export interface InsertResult {
  /** 插入后的完整文本 */
  newValue: string;
  /** 新光标起始位置 */
  newSelectionStart: number;
  /** 新光标结束位置 */
  newSelectionEnd: number;
}

/**
 * 在选区前后包裹语法。无选区时插入占位文本。
 * @param state - textarea 当前状态
 * @param before - 选区前插入的文本
 * @param after - 选区后插入的文本
 * @param placeholder - 无选区时的占位文本
 * @returns 插入结果
 */
function wrapSelection(
  state: TextareaState,
  before: string,
  after: string,
  placeholder: string,
): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const text = selectedText || placeholder;
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);
  const newValue = beforeText + before + text + after + afterText;

  if (selectedText) {
    return {
      newValue,
      newSelectionStart: selectionStart + before.length,
      newSelectionEnd: selectionStart + before.length + selectedText.length,
    };
  }
  // 无选区时选中占位文本
  const placeholderStart = selectionStart + before.length;
  return {
    newValue,
    newSelectionStart: placeholderStart,
    newSelectionEnd: placeholderStart + placeholder.length,
  };
}

/**
 * 在光标所在行首插入前缀。若已选多行，每行都插入。
 * @param state - textarea 当前状态
 * @param prefix - 行首前缀文本
 * @param placeholder - 空行时的占位文本
 * @returns 插入结果
 */
function prefixLine(
  state: TextareaState,
  prefix: string,
  placeholder: string,
): InsertResult {
  const { value, selectionStart, selectionEnd } = state;

  // 找到选区起始行的行首
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  // 找到选区结束行的行尾
  let lineEnd = value.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;

  const selectedLines = value.slice(lineStart, lineEnd);
  const lines = selectedLines.split('\n');

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return prefix + placeholder;
    return prefix + line;
  });

  const newText = newLines.join('\n');
  const before = value.slice(0, lineStart);
  const after = value.slice(lineEnd);
  const newValue = before + newText + after;

  return {
    newValue,
    newSelectionStart: lineStart,
    newSelectionEnd: lineStart + newText.length,
  };
}

/** 插入加粗语法 */
export function insertBold(state: TextareaState): InsertResult {
  return wrapSelection(state, '**', '**', '粗体文本');
}

/** 插入斜体语法 */
export function insertItalic(state: TextareaState): InsertResult {
  return wrapSelection(state, '*', '*', '斜体文本');
}

/** 插入行内代码语法 */
export function insertInlineCode(state: TextareaState): InsertResult {
  return wrapSelection(state, '`', '`', '代码');
}

/** 插入链接语法 */
export function insertLink(state: TextareaState): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);

  const displayText = selectedText || '链接文本';
  const insertText = `[${displayText}](url)`;
  const newValue = beforeText + insertText + afterText;

  const urlStart = selectionStart + displayText.length + 3;
  return {
    newValue,
    newSelectionStart: urlStart,
    newSelectionEnd: urlStart + 3,
  };
}

/** 插入代码块语法 */
export function insertCodeBlock(state: TextareaState): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);

  const codeContent = selectedText || '代码内容';
  const insertText = `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
  const newValue = beforeText + insertText + afterText;

  const contentStart = selectionStart + 5;
  const contentEnd = contentStart + codeContent.length;

  if (selectedText) {
    return { newValue, newSelectionStart: contentStart, newSelectionEnd: contentEnd };
  }
  return { newValue, newSelectionStart: contentStart, newSelectionEnd: contentEnd };
}

/** 插入标题语法 */
export function insertHeading(state: TextareaState, level: 1 | 2 | 3): InsertResult {
  const prefix = '#'.repeat(level) + ' ';
  return prefixLine(state, prefix, '标题');
}

/** 插入有序列表语法 */
export function insertOrderedList(state: TextareaState): InsertResult {
  return prefixLine(state, '1. ', '列表项');
}

/** 插入无序列表语法 */
export function insertUnorderedList(state: TextareaState): InsertResult {
  return prefixLine(state, '- ', '列表项');
}
