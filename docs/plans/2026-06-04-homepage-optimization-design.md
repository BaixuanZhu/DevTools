# 首页优化 + 二级路径重构

日期：2026-06-04

## 背景

首页需要视觉升级和功能完善，项目路由需要从扁平结构改为二级路径以提升模块化程度。

## 改动清单

### 1. 首页 Hero 区域重构

- 新增 Hero 区域：居中大标题 + 副标题 + 搜索框 + 分类芯片
- 搜索框从 Header 移入首页 Hero 区域，宽度 `max-w-[560px]`
- 副标题："零门槛的浏览器端开发者工具，即开即用"
- 分类筛选芯片位于搜索框正下方，水平可滚动
- 所有过滤逻辑合并到同一个 Alpine `x-data`，修复两个作用域隔离 bug

### 2. Header 简化

- 移除 Header 中的搜索框
- Header 仅保留 Logo（左）+ 汉堡菜单（移动端右）

### 3. Bug 修复：分类筛选器失效

- 根因：分类按钮行（`x-data="{ active: 'all' }"`）和工具网格（`x-data="{ active: 'all', ... }"`）各有独立作用域
- 分类按钮调用 `applyFilter()` 但该方法不在按钮行作用域中
- 修复：将所有状态和方法合并到工具网格的 `x-data`，分类按钮通过 `$parent` 或合并到同一作用域

### 4. 页面二级路径迁移

当前 → 目标映射：

| 当前路径 | 目标路径 | 分类 |
|---------|---------|------|
| `/base64` | `/encoding/base64` | 编码转换 |
| `/url-encode` | `/encoding/url-encode` | 编码转换 |
| `/jwt-parser` | `/encoding/jwt-parser` | 编码转换 |
| `/hash-generator` | `/crypto/hash-generator` | 加密哈希 |
| `/symmetric-crypto` | `/crypto/symmetric-crypto` | 加密哈希 |
| `/uuid-generator` | `/text/uuid-generator` | 文本处理 |
| `/random-string` | `/text/random-string` | 文本处理 |
| `/datetime-converter` | `/datetime/datetime-converter` | 日期时间 |
| `/device-info` | `/network/device-info` | 网络工具 |

分类 slug 映射：

| 中文名 | 英文 slug |
|--------|----------|
| 编码转换 | encoding |
| 加密哈希 | crypto |
| 文本处理 | text |
| 日期时间 | datetime |
| 网络工具 | network |
| 格式化 | format |
| 正则工具 | regex |
| 颜色工具 | color |
| CSS 工具 | css |
| API 工具 | api |

### 5. 旧 URL 重定向

通过 Astro middleware 或 catch-all 路由对旧扁平 URL 做 301 重定向到新二级路径。

### 6. 首页样式

- Hero 标题：`text-4xl font-bold`，居中
- 副标题：`text-muted text-base`，居中
- 搜索框：`max-w-[560px]`，`rounded-lg`，更大更醒目
- 分类芯片保持 filter chip 样式（DESIGN.md 定义）
- 工具卡片网格保持现有样式

## 涉及文件

- `src/pages/index.astro` — Hero 重构 + bug 修复
- `src/layouts/ToolLayout.astro` — Header 简化
- `src/pages/*.astro` → `src/pages/<category>/*.astro` — 二级路径迁移
- `src/data/tools.ts` — path 字段更新
- `src/middleware.ts`（新增）— 旧 URL 重定向
- `STRUCTURE.md` — 文档更新
