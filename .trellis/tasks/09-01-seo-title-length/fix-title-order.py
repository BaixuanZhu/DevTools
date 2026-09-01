# -*- coding: utf-8 -*-
"""修正 tools.ts 中 title 字段位置：id/title/name -> id/name/title，并回读校验长度区间。"""
import re
import io
import sys

TOOLS = r"E:\WEBProjects\dev-tools\src\data\tools.ts"
MIN, MAX = 25, 60

with io.open(TOOLS, 'r', encoding='utf-8') as f:
    content = f.read()

# 当前结构为 id 行后紧跟 title 行、再 name 行，交换 name 与 title 两行
fixed, n = re.subn(
    r"(id: '[^']+',\n)(    title: '[^']*',\n)(    name: '[^']*',\n)",
    r"\1\3\2",
    content,
)
print(f"交换字段顺序：{n} 处")
assert n == 52, f"期望交换 52 处，实际 {n}"

with io.open(TOOLS, 'w', encoding='utf-8', newline='') as f:
    f.write(fixed)

with io.open(TOOLS, 'r', encoding='utf-8') as f:
    content = f.read()

pairs = re.findall(r"id: '([^']+)',\n    name: '[^']*',\n    title: '([^']*)'", content)
print(f"共校验 {len(pairs)} 条：")
assert len(pairs) == 52
bad, lens = 0, []
for tool_id, title in pairs:
    ln = len(title)
    lens.append(ln)
    flag = '' if MIN <= ln <= MAX else '  <-- 越界!'
    if flag:
        bad += 1
    print(f"{ln:3d}  {tool_id:28s} {title}{flag}")

print(f"\nmin={min(lens)} max={max(lens)} 越界={bad}")
sys.exit(1 if bad else 0)
