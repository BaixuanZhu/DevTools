/**
 * JSON 转 XML 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertJsonToXml, validateRootName } from '../json-to-xml';

describe('convertJsonToXml', () => {
  it('基础对象转换', () => {
    const result = convertJsonToXml('{"name":"Alice","age":30}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.result).toContain('<name>Alice</name>');
      expect(result.result).toContain('<age>30</age>');
    }
  });

  it('数组转换（复数键去 s 启发式）', () => {
    const result = convertJsonToXml('{"users":[{"name":"Alice"},{"name":"Bob"}]}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<users>');
      expect(result.result).toContain('<user>');
      expect(result.result).toContain('<name>Alice</name>');
      expect(result.result).toContain('<name>Bob</name>');
      expect(result.result).toContain('</user>');
      expect(result.result).toContain('</users>');
    }
  });

  it('数组转换（非复数键加 _item）', () => {
    const result = convertJsonToXml('{"data":[{"id":1},{"id":2}]}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<data>');
      expect(result.result).toContain('<data_item>');
      expect(result.result).toContain('<id>1</id>');
      expect(result.result).toContain('<id>2</id>');
      expect(result.result).toContain('</data_item>');
      expect(result.result).toContain('</data>');
    }
  });

  it('嵌套对象', () => {
    const result = convertJsonToXml('{"user":{"name":"Alice","profile":{"age":30}}}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<user>');
      expect(result.result).toContain('<name>Alice</name>');
      expect(result.result).toContain('<profile>');
      expect(result.result).toContain('<age>30</age>');
      expect(result.result).toContain('</profile>');
      expect(result.result).toContain('</user>');
    }
  });

  it('null 处理为空元素', () => {
    const result = convertJsonToXml('{"value":null}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<value></value>');
    }
  });

  it('boolean 处理', () => {
    const result = convertJsonToXml('{"active":true,"deleted":false}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<active>true</active>');
      expect(result.result).toContain('<deleted>false</deleted>');
    }
  });

  it('number 处理', () => {
    const result = convertJsonToXml('{"count":42,"price":19.99}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<count>42</count>');
      expect(result.result).toContain('<price>19.99</price>');
    }
  });

  it('XML 特殊字符转义', () => {
    const result = convertJsonToXml('{"text":"a & b < c > d \\"e\\" f\'"}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('&amp;');
      expect(result.result).toContain('&lt;');
      expect(result.result).toContain('&gt;');
      expect(result.result).toContain('&quot;');
      expect(result.result).toContain('&apos;');
    }
  });

  it('自定义根元素名', () => {
    const result = convertJsonToXml('{"name":"test"}', 'customRoot');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<customRoot>');
      expect(result.result).toContain('</customRoot>');
    }
  });

  it('无效 JSON 报错', () => {
    const result = convertJsonToXml('{bad}', 'root');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('空对象输出空元素', () => {
    const result = convertJsonToXml('{}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<root>');
      expect(result.result).toContain('</root>');
    }
  });

  it('空数组输出空元素', () => {
    const result = convertJsonToXml('{"items":[]}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<items></items>');
    }
  });

  it('空字符串输入返回错误', () => {
    const result = convertJsonToXml('', 'root');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('纯空白输入返回错误', () => {
    const result = convertJsonToXml('   ', 'root');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('顶层数组转换', () => {
    const result = convertJsonToXml('[1, 2, 3]', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<root>');
      expect(result.result).toContain('<root_item>1</root_item>');
      expect(result.result).toContain('<root_item>2</root_item>');
      expect(result.result).toContain('<root_item>3</root_item>');
      expect(result.result).toContain('</root>');
    }
  });

  it('嵌套数组转换', () => {
    const result = convertJsonToXml('[[1, 2], [3, 4]]', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<root>');
      expect(result.result).toContain('<root_item>');
      expect(result.result).toContain('<root_item_item>1</root_item_item>');
      expect(result.result).toContain('<root_item_item>2</root_item_item>');
      expect(result.result).toContain('</root_item>');
      expect(result.result).toContain('</root>');
    }
  });
});

describe('validateRootName', () => {
  it('空字符串无效', () => {
    const result = validateRootName('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('根元素名不能为空');
    }
  });

  it('纯空格无效', () => {
    const result = validateRootName('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('根元素名不能为空');
    }
  });

  it('含非法字符无效', () => {
    const result = validateRootName('root@name');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('根元素名只能包含字母、数字、下划线和连字符');
    }
  });

  it('数字开头无效', () => {
    const result = validateRootName('1root');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('根元素名只能包含字母、数字、下划线和连字符');
    }
  });

  it('合法名称通过', () => {
    expect(validateRootName('root').ok).toBe(true);
    expect(validateRootName('root-name').ok).toBe(true);
    expect(validateRootName('root_name').ok).toBe(true);
    expect(validateRootName('root123').ok).toBe(true);
    expect(validateRootName('_root').ok).toBe(true);
  });
});
