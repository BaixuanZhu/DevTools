# Redis 配置文件生成器

## Goal

devops 分类新增 Redis 配置文件可视化生成器工具页：硬件/场景/版本输入 → 实时生成带版本标注和中文注释的 redis.conf，支持复制/下载；系列工具（MySQL/PG）的首个实现

## Background / Motivation

- 竞品缺口已验证：PGTune（PostgreSQL）长期流行；MySQL 无权威在线生成器；Redis 完全没有主流在线生成器——缺口最大，故系列从 Redis 开始。
- 差异化卖点：AI 问答无法直接产出可下载的配置文件；本工具输出确定性、参数可溯源（官方文档链接）、支持复制/下载。
- 工具页独特形态原则（2026-08-28 用户确认）：本工具是第一个实践"壳层统一、形态自由"的工具，私有组件不进全局 `components/`。

## Scope

**做**：
- 单页工具 `/devops/redis-config-generator`，浏览器端运算、无后端。
- 部署模式：单机 / 主从（复制参数组仅主从模式出现）。
- 版本轴：7.0 / 7.2 / 7.4 / 8.0（下拉切换，参数按版本过滤联动）。
- 约 55 个参数、11 组（网络连接 / 内存策略 / RDB / AOF / 数据结构编码 / 安全 / 客户端缓冲 / 观测 / Lazy Free / 键空间 / 复制）。
- 系统参数建议区块（sysctl、THP、somaxconn、nofile——不属于 redis.conf，单独附加输出）。

**不做**（后续任务/版本再议）：
- Cluster 集群参数族、Sentinel。
- Lua/Functions、Stream 细节参数（使用率低，避免面板膨胀）。
- MySQL / PostgreSQL 版本（独立任务立项）。
- 配置文件导入/解析（反向功能）。

## Requirements

### 功能需求

1. **左栏控制面板**：
   - 部署模式单选（单机 / 主从）；主从模式要求填主库地址端口，展开复制参数组
   - 硬件画像：CPU 核数、内存（GB）、磁盘类型（HDD / SSD / NVMe）
   - 使用场景：缓存 / 会话 / 队列 / 混合（驱动默认值）
   - 持久化策略：RDB / AOF / 混合 / 关闭
   - Redis 版本下拉（7.0 / 7.2 / 7.4 / 8.0）
   - 并发连接数预估
2. **右栏实时预览**：生成中的 redis.conf，等宽字体 + 行号；注释行与参数行视觉区分；参数值变动时对应行短暂高亮；底部操作条：复制 / 下载 redis.conf / 重置为推荐值。
3. **参数行形态**：参数名 + 控件 + 推荐范围刻度条（保守 / 推荐 / 激进三段可视化，当前值落点可见，超出范围亮警示）。
4. **控件类型按参数性质**：枚举参数（`maxmemory-policy` 8 个策略、`appendfsync` 等）用下拉，选项带中文说明；布尔参数用开关；连续数值用滑块；`notify-keyspace-events` 用键位多选；文本参数（主库地址、密码）用输入框。默认值由场景/硬件公式驱动，用户可覆盖。
5. **版本标注**：7.0+ 引入的参数显示版本徽章；目标版本下已废弃的参数不写入 conf，面板保留该行并显示"已废弃 → 替代参数"提示；版本切换联动过滤。
6. **中文注释与溯源**：每个参数带"为什么是这个值"的中文注释；提供官方文档链接。
7. **系统参数建议区块**：预览底部可折叠输出 `vm.overcommit_memory`、THP、`somaxconn`（与 `tcp-backlog` 联动）、`nofile` ulimit。
8. **免责声明**：页面标注"输出为参考值，需结合 INFO / 慢查询 / 监控调整"。

### 约束

- **站点强制**：Security Rules（禁止 eval；密码用 Web Crypto 本地生成）；Tool Page Requirements（清空/复制按钮 + 反馈、打开即用的合理默认值、`tools.ts` SEO 全字段、FAQ 同步）。
- **架构**：纯浏览器端，计算瞬时无需 Web Worker；无路径别名（相对 import）；toastStore 通知、useCopy 复制。
- **形态原则**：私有组件与数据放 `src/tools/devops/redis-config/` 目录内，不上浮全局 `components/`（跨 3+ 工具复用才上浮）；壳层用 ToolLayout（SEO / FAQ / 相关工具区块保留）。
- **视觉**：DESIGN.md 设计令牌；间距 4px 单位规则（禁止用任意值表达标准类可表达的值）；暗色模式适配。
- **数据准确性**：参数版本标注以研究笔记 `research/redis-params-version-notes.md` 为准（源：Redis 官方文档）；存疑项实现时人工复核。

## Acceptance Criteria

- [ ] 注册表完整：`tools.ts` 全字段（id/category/path/name/description/seoDescription/keywords/icon/relatedToolIds）+ FAQ（`tool-faqs.ts`）+ 路由 `/devops/redis-config-generator` + sitemap 含该页。
- [ ] 打开即用：不改任何输入也能生成合法、可直接使用的 redis.conf（合理默认值）。
- [ ] 版本联动：选 7.0 时 7.2+ 引入的参数不出现；目标版本已废弃的参数默认不写入 conf，面板显示替代提示。
- [ ] 枚举参数均为下拉/多选，选项带中文说明，推荐项可辨识。
- [ ] 部署模式联动：单机模式 conf 无复制参数；主从模式展开复制组且主库地址必填校验。
- [ ] 复制按钮给 toast 反馈；下载产出文件名 `redis.conf`；重置恢复推荐值。
- [ ] 每个参数可见中文注释与推荐范围；含免责声明。
- [ ] 单元测试覆盖：参数计算公式、版本过滤逻辑、conf 模板渲染。
- [ ] `pnpm build` / `pnpm test` / `pnpm astro check` 全绿。
- [ ] 暗色模式与移动端（基础响应式）可用。
