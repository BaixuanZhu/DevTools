# Implement — ICO 图标制作工具（创作形态）

## 执行清单（顺序执行，每步可独立验证）

1. [ ] **底层** `src/utils/media/ico-parse.ts` + `__tests__/ico-parse.test.ts` — 契约见 design.md；公共函数 TSDoc 齐全
2. [ ] **编码器微调** `encoders/ico.ts`：导出 `rasterizeToPng`（TSDoc 注明复用方）；删 `DEFAULT_ICO_SIZE`；同步 `ico.test.ts` 引用
3. [ ] **ImageCropper 增强**：加可选 prop `defaultAspect`（默认 'free'，TSDoc 说明用途）；批量工具裁切弹窗回归确认
4. [ ] **模式 A** `src/components/media/IcoMakerPanel.vue`
   - 三段式：导入区（拖/点/Ctrl+V）→ 内嵌 ImageCropper（default-aspect="1:1"，含"跳过裁切"快速路径）→ 参数区（尺寸多选/适配/锚点/填白）+ 预览网格 + 下载
   - "重新裁切"：保留 originalUrl 与参数，重建位图与预览
   - object URL / bitmap 生命周期管理（变更即 revoke/close）
5. [ ] **模式 B** `src/components/media/IcoParsePanel.vue` — parseIco → 条目表 + 懒预览 + 提取 PNG
6. [ ] **页面组件** `src/tools/frontend/IcoMaker.vue`：ui/tabs「制作 ICO」/「解析 ICO」+ ToolHeader；onUnmounted 统一释放
7. [ ] **路由** `src/pages/frontend/ico-maker.astro`（ToolLayout toolId="frontend/ico-maker"，client:idle）
8. [ ] **批量工具去 ICO 化**
   - image-convert.ts：OutputFormat/OUTPUT_FORMATS/LOSSLESS_FORMATS/pickEncoderKind/EncoderKind/convertImage 删 ico；defaultFormatForInput 保留 x-icon→png
   - useImageBatch.ts：ConvertParams 删 ico 三字段 + watch 收敛
   - ImageConverterControls.vue / ImageConverter.vue：删 ICO 设置区与初始化
9. [ ] **注册与文案** tools.ts（新 ToolMeta id=ico-maker + image-converter 描述/keywords/relatedToolIds 改）+ tool-faqs.ts（迁移 + 新增）
10. [ ] **测试收口** image-convert.test.ts 删改；全量门禁

## 验证命令

```bash
pnpm test src/utils/media/__tests__/ico-parse.test.ts src/utils/media/encoders/__tests__/ico.test.ts src/utils/media/__tests__/image-convert.test.ts
pnpm test && pnpm astro check && pnpm build
```

## 人工验收门（实现完成后）

1. 创作流：透明 PNG → 1:1 裁切局部 → 16/32/48/256 → 预览正确 → 下载 .ico → 拖回解析模式 4 条目一致；重新裁切后预览刷新、参数保留。
2. 跳过裁切快速路径：非正方形原图 + contain + 填白 → 生成成功。
3. 解析：旧版 .ico（BMP 条目）全部条目可提取 PNG；损坏文件中文报错。
4. 批量工具：裁切弹窗行为不变；ICO 输出消失、文案无 ICO；ICO 文件输入仍可转 PNG。
5. 暗色主题过一遍双模式 UI。

## 回滚点

- 步骤 1~3（底层/增强）与 4~7（UI）与 8~10（去 ICO 化+文案）分三组 commit；异常 revert 对应组。
- 无新增依赖、无构建配置改动。

## Spec 更新（Phase 3.3）

- "编码器内部函数上浮为模块导出以复用（rasterizeToPng）"如构成新模式，补入 `.trellis/spec/frontend/component-guidelines.md`。
