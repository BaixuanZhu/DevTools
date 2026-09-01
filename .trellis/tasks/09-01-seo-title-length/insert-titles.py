# -*- coding: utf-8 -*-
"""向 src/data/tools.ts 每个工具条目的 name 行后插入手写 title 字段（任务 09-01-seo-title-length）。

幂等性：已含 title 的条目跳过；插入后按 JS 字符数校验 25-60 区间并打印全量长度分布。
"""
import re
import io
import sys

TOOLS = r"E:\WEBProjects\dev-tools\src\data\tools.ts"

TITLES = {
    'number-base-converter': '进制转换器 - 二进制/十六进制互转与 BigInt 大数进制计算 - DevTools',
    'text-toolbox': '文本处理工具箱 - 大小写转换、去重排序与字数统计 - DevTools',
    'uuid-generator': 'UUID 生成器 - 在线批量生成 v4/v7 与解析版本时间戳 - DevTools',
    'hash-generator': '哈希生成器 - MD5/SHA 系列哈希计算与 HMAC 签名 - DevTools',
    'random-string': '随机字符串生成 - 自定义长度字符集与排除易混淆字符 - DevTools',
    'datetime-converter': '日期时间转换器 - Unix 时间戳与多时区日期互转 - DevTools',
    'jwt-parser': 'JWT 编解码 - Token 在线解析、验签与构造 - DevTools',
    'device-info': '设备信息与 UA 查看 - 浏览器 UA 与屏幕分辨率在线检测 - DevTools',
    'http-status-codes': 'HTTP 状态码查询 - 全部状态码中文释义与排查建议 - DevTools',
    'ipv4-cidr': 'IPv4 子网计算器 - CIDR 网络地址与可用主机段计算 - DevTools',
    'ipv6-cidr': 'IPv6 子网计算器 - CIDR 地址范围与地址类型识别 - DevTools',
    'ipv4-range-expander': 'IPv4 范围展开 - IP 区间转最简 CIDR 列表 - DevTools',
    'url': 'URL 解析器 - 在线编码解码与 query 参数编辑 - DevTools',
    'symmetric-crypto': '对称加解密 - AES/SM4/ChaCha20 多算法在线加密解密 - DevTools',
    'asymmetric-crypto': '非对称加解密 - RSA/ECDSA 密钥生成与签名验签 - DevTools',
    'sm2-crypto': 'SM2 国密加解密 - 密钥对生成、加解密与签名验签 - DevTools',
    'qr-code-generator': '二维码生成器 - 自定义颜色尺寸容错与 PNG/SVG 下载 - DevTools',
    'base64': 'Base64 编解码 - 多字符集文本转码与中文乱码修复 - DevTools',
    'base64-to-image': 'Base64 转图片 - Data URI 解码预览与图片还原下载 - DevTools',
    'base64-to-file': 'Base64 转文件 - MIME 自动识别与任意文件还原下载 - DevTools',
    'file-to-base64': '文件转 Base64 - 图片文档编码与分块大文件处理 - DevTools',
    'cron-parser': 'Cron 表达式解析 - 中文翻译、执行时间预览与可视化构建 - DevTools',
    'time-calculator': '时间差计算器 - 两时间点间隔与时间戳差值在线计算 - DevTools',
    'json-formatter': 'JSON 格式化器 - 美化压缩与语法校验、错误行列定位 - DevTools',
    'json-diff': 'JSON 差异对比 - 语义/严格双模式与键值变更高亮 - DevTools',
    'json-to-xml': 'JSON 转 XML - 自定义根元素与属性节点规则转换 - DevTools',
    'json-to-yaml': 'JSON 转 YAML - 双向互转与嵌套缩进自动对齐 - DevTools',
    'json-to-ts': 'JSON 转 TS - 智能生成 interface 类型定义 - DevTools',
    'markdown-editor': 'Markdown 编辑器 - 多文档草稿箱与 mermaid 工作台 - DevTools',
    'docker-converter': 'Docker 配置转换 - run 与 compose 实时双向互转 - DevTools',
    'docker-run-helper': 'Docker Run 命令助手 - 表单生成命令与 flag 速查表 - DevTools',
    'env-converter': '环境变量转换器 - .env 与 JSON 双向互转及类型推断 - DevTools',
    'meta-tag-generator': 'Meta 标签生成器 - OG 与 JSON-LD 在线一键生成 - DevTools',
    'robots-generator': 'robots.txt 生成器 - 可视化规则与拦截 AI 爬虫 - DevTools',
    'sitemap-generator': 'sitemap 生成器 - 在线输出网站地图与 lastmod - DevTools',
    'redis-config-generator': 'Redis 配置生成器 - 按硬件与场景生成 redis.conf - DevTools',
    'mysql-config-generator': 'MySQL 配置生成器 - 按硬件版本生成 my.cnf 与内核参数 - DevTools',
    'postgres-config-generator': 'PostgreSQL 配置生成器 - 按硬件与版本生成 pg 配置 - DevTools',
    'qr-code-reader': '二维码识别器 - 上传/粘贴截图在线解码与链接识别 - DevTools',
    'image-converter': '图片转换与压缩 - PNG/WebP/AVIF 批量互转与质量缩放 - DevTools',
    'ico-maker': 'ICO 图标制作 - 多尺寸 favicon 生成与图标解析提取 - DevTools',
    'tester': '正则表达式测试 - 实时高亮匹配与常用正则速查 - DevTools',
    'panel': '颜色面板 - HEX/RGB/HSL 互转与 WCAG 对比度检查 - DevTools',
    'unit-converter': 'CSS 单位转换器 - px/rem/vw 实时互转与基准自定义 - DevTools',
    'gradient': 'CSS 渐变生成器 - 线性径向圆锥可视化调色与预设 - DevTools',
    'fake-data-generator': '假数据生成器 - 自定义字段批量导出 JSON/CSV 测试数据 - DevTools',
    'image-scrambler': '图片混淆 - 可逆块级像素置乱与一键还原 - DevTools',
    'phantom-tank': '幻影坦克 - 双图合成透明 PNG 表里图效果 - DevTools',
    'toml-json-converter': 'TOML 与 JSON 互转 - 实时双向转换与美化紧凑输出 - DevTools',
    'toml-yaml-converter': 'TOML 与 YAML 互转 - 缩进风格切换与并排对照 - DevTools',
    'toml-formatter': 'TOML 格式化器 - 语法校验与错误行列定位 - DevTools',
    'wheel-picker': '转盘抽奖 - 自定义选项权重与链接分享抽签 - DevTools',
}

MIN, MAX = 25, 60

with io.open(TOOLS, 'r', encoding='utf-8') as f:
    lines = f.readlines()

out, inserted, skipped = [], 0, 0
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    m = re.match(r"\s*id: '([^']+)',\s*$", line)
    if m:
        tool_id = m.group(1)
        if tool_id in TITLES:
            # 下一行必须是 name 行，紧随其后插入 title 行
            name_line = lines[i + 1]
            assert re.match(r"\s*name: '[^']*',\s*$", name_line), f"{tool_id}: name 行结构异常"
            assert 'title:' not in name_line, f"{tool_id}: 已存在 title?"
            out.append("    title: '%s',\n" % TITLES[tool_id])
            inserted += 1
            del TITLES[tool_id]  # 剩余的为未匹配项
    i += 1

assert inserted == 52, f"插入数 {inserted} != 52"
assert not TITLES, f"未匹配到的工具 id: {sorted(TITLES)}"

with io.open(TOOLS, 'w', encoding='utf-8', newline='') as f:
    f.writelines(out)

# 回读校验长度
with io.open(TOOLS, 'r', encoding='utf-8') as f:
    content = f.read()

pairs = re.findall(r"id: '([^']+)',\n    name: '[^']*',\n    title: '([^']*)'", content)
print(f"共校验 {len(pairs)} 条：")
bad = 0
lens = []
for tool_id, title in pairs:
    n = len(title)
    lens.append(n)
    flag = '' if MIN <= n <= MAX else '  <-- 越界!'
    if flag:
        bad += 1
    print(f"{n:3d}  {tool_id:28s} {title}{flag}")

print(f"\nmin={min(lens)} max={max(lens)} 越界={bad}")
sys.exit(1 if bad else 0)
