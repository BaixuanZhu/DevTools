# 实施计划

## 执行清单（有序）

1. [x] 重构 `src/utils/editor/markdown-export.ts`：`HtmlExportTheme` + `HTML_EXPORT_THEMES`（5 套）+ `buildHtmlDocument` 公开化（默认主题烘入、title 注入、全部主题变量段、静态切换器脚本）+ `exportHtml` options 扩展
2. [x] 新增单测 `src/utils/editor/__tests__/markdown-export.test.ts`：
   - 注册表完整性：5 主题、id 唯一、每主题变量集齐全；
   - 产物包含全部 `data-theme` 变量段与切换器脚本；默认主题正确烘入；
   - 无外部资源引用（正则断言无 `<link` 外链 / `src="http` / `url(http`）；
   - title 注入与缺省回退。
3. [x] 新建 `src/components/markdown/HtmlExportDialog.vue`（对话框 + radiogroup 主题选择 + 沙箱 iframe 预览 + 下载/取消）
4. [x] `MarkdownWorkstation.vue`：HTML 菜单项改为打开对话框，传入 markdown/title/filename
5. [x] 验证命令（见下）+ 浏览器冒烟：逐一切换 5 主题目检预览、验证下载文件内切换器与 localStorage 记忆

## 验证命令

```bash
pnpm test markdown-export
pnpm test
pnpm astro check
pnpm build
```

## 评审门 / 回滚点

- 步骤 2 完成后：产物结构确认（零外部依赖契约）再进组件；
- 单 commit 交付，revert 即整体回滚；无数据/路由迁移。
