# Implement — 图片格式转换扩展

## 执行清单（顺序执行）

1. [ ] **依赖** `pnpm add gifenc libheif-js`；确认 gifenc 侧无传递依赖膨胀（pnpm why）
2. [ ] **BMP 编码器** `encoders/bmp.ts` + `encoders/__tests__/bmp.test.ts`（纯函数先行）
3. [ ] **GIF 编码器** `encoders/gif.ts` + `encoders/__tests__/gif.test.ts`
4. [ ] **SVG 解码器** `decoders/svg.ts`（含无尺寸回退链；TSDoc 注明 secure static mode 安全边界）
5. [ ] **HEIC spike**：最小脚本实测 libheif-js 浏览器 import 路径/interop/wasm 资产 → 定稿后写 `decoders/heic.ts`；`astro.config.mjs` 按需追加 optimizeDeps.exclude
6. [ ] **接线** `image-convert.ts`：枚举/映射/convertImage 分支/defaultFormatForInput（对照 design.md 表格逐项）
7. [ ] **UI 文案** ImageConverter.vue 空态格式清单；ImageConverterControls 如需 GIF 质量提示
8. [ ] **SEO/FAQ** tools.ts（description/seoDescription/keywords）；tool-faqs.ts（更新 1 条 + 新增 2 条）
9. [ ] **测试收口** image-convert.test.ts 新枚举用例；全量门禁

## 验证命令

```bash
pnpm test src/utils/media/encoders/__tests__/bmp.test.ts src/utils/media/encoders/__tests__/gif.test.ts
pnpm test && pnpm astro check && pnpm build
ls -la dist/_astro/*.js | sort -k5 -n | tail   # 核对 libheif/gifenc 独立 chunk、主包体积
```

## 人工验收门

1. 透明 PNG → BMP → 重新拖入工具可解码且透明保留（自环）。
2. SVG（含无 width/height 仅 viewBox 的样例）与 .heic 实拍图各转一次成功。
3. DevTools Network：HEIC 首次导入时才出现解码器 chunk；主 chunk 体积与基线一致。
4. GIF 质量滑块 10 vs 100 输出体积差异明显；暗色主题过一遍新 UI 文案。

## 回滚点

- 步骤 2/3/4/5 各自独立可回滚；6~9 一个 commit。依赖回滚时同步删 optimizeDeps.exclude。

## Spec 更新（Phase 3.3）

- 若 libheif-js spike 发现新的 Vite/Emscripten 集成坑，沉淀到 `.trellis/spec/frontend/quality-guidelines.md`（与 @jsquash/avif 先例并列）。
