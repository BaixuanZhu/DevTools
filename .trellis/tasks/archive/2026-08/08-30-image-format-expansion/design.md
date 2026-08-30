# Design — 图片格式转换扩展

## 架构对位（完全沿用现有编码器/解码器模式）

```
convertImage(format)                          loadImage(file)
  ├─ canvas 原生: png/jpeg/webp                ├─ image/tiff → decoders/tiff.ts (utif2)
  ├─ avif → encoders/avif.ts (@jsquash)       ├─ image/svg+xml|.svg → decoders/svg.ts   【新增】
  ├─ tiff → encoders/tiff.ts (utif2)          ├─ heic/heif|.heic|.heif → decoders/heic.ts 【新增】
  ├─ bmp → encoders/bmp.ts   【新增，自研】     └─ 其余 → createImageBitmap
  └─ gif → encoders/gif.ts   【新增，gifenc】
```

## encoders/bmp.ts（自研，无依赖）

字节布局（32bpp，自底向上，32bpp 行天然 4 字节对齐）：

```
BITMAPFILEHEADER 14B: 'BM' | bfSize u32 | rsv u16×2 | bfOffBits u32 = 14+108
BITMAPV4HEADER  108B: biSize=108 | w i32 | h i32(正=底向上) | planes=1 | bitCount=32
                    | compression=BI_BITFIELDS(3) | imageSize | ...rsv...
                    | masks R=0x00FF0000 G=0x0000FF00 B=0x000000FF A=0xFF000000
                    | bV4CSType=0x73524742('sRGB') | 终点 rsv
像素区: RGBA → BGRA，行序反转（首行像素在缓冲末尾）
```

- 纯函数 `encodeBmpBytes({width, height, data}): Uint8Array`（node 可测）；`encodeBmp(imageData): Promise<Blob>` 薄封装（image/bmp）。
- 透明：alpha 掩码在 V4 头中声明，GIMP/PS/浏览器均可读；不提供/不需要 fillBackground。
- 选 V4 而非 40B 头 + 3 掩码的原因：后者 GDI 忽略 alpha，透明丢失。

## encoders/gif.ts（gifenc，懒加载）

```ts
const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
export function qualityToMaxColors(quality: number): number  // 纯函数
  // clamp(Math.round(quality / 100 * 256), 16, 256)，quality∈[10,100]
export async function encodeGif(imageData: ImageData, quality: number): Promise<Blob> {
  const maxColors = qualityToMaxColors(quality);
  const palette = quantize(rgba, maxColors, { format: 'rgba4444' }); // 保留 alpha
  const index = applyPalette(rgba, palette, 'rgba4444');
  const gif = GIFEncoder();
  gif.writeFrame(index, w, h, { palette, transparent: true });
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
```

- 分组：lossy（量化即有损）；质量滑块语义 = 调色板颜色数，UI 提示文案在 Controls 中说明。
- gifenc 纯 JS ESM、零依赖、MIT、单文件，符合 Dependency Rules（成熟稳定优先）。

## decoders/svg.ts

```ts
export async function decodeSvg(file: File): Promise<LoadedImage> {
  // 1. objectURL → <img>.decode()（secure static mode：脚本不执行；blob 同源不污染 canvas）
  // 2. naturalWidth/Height > 0 → 用之
  // 3. =0 → file.text() 正则取 viewBox="…W H"（容许多余空白）
  // 4. 仍无 → 512×512 兜底
  // 5. canvas 绘制（先过 checkCanvasLimits）→ createImageBitmap(canvas)
}
```

- `loadImage` 分派：`file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)`。

## decoders/heic.ts（libheif-js，懒加载）

```ts
export async function decodeHeic(file: File): Promise<LoadedImage> {
  const libheif = await import('libheif-js');        // interop 以实测为准（default/命名空间兜底，同 tiff.ts 先例）
  const data = new libheif.HeifDecoder().decode(await file.arrayBuffer());
  const image = data[0];                              // 取首图
  const w = image.get_width(), h = image.get_height();
  const rgba = new Uint8ClampedArray(w * h * 4);
  await new Promise((res, rej) => image.display({ data: rgba, width: w, height: h },
    (d) => d ? res() : rej(new Error('HEIC 解码失败'))));
  // rgba → canvas → createImageBitmap；EXIF 方向由 display 输出已含旋转的像素，无需再纠偏
}
```

- `loadImage` 分派：`/image\/hei[cf](-sequence)?/` MIME 或 `/\.(heic|heif)$/i` 扩展名，先于 createImageBitmap 判定。
- 加载策略：动态 import → 独立 chunk；`astro.config.mjs` `vite.optimizeDeps.exclude` 追加 `libheif-js`（若 dev 预构建报错，与 @jsquash/avif 同例处理）；验收时核对 dist 主包不增。
- 失败提示归一化：沿用 loadImage 现有中文错误，追加 HEIC 场景描述。

## image-convert.ts 接线

| 变更点 | 内容 |
|--------|------|
| OutputFormat | + `'bmp' \| 'gif'` |
| OUTPUT_FORMATS | lossy: jpeg/webp/avif/**gif**；lossless: png/tiff/**bmp** |
| LOSSLESS_FORMATS | + 'bmp'（GIF 有损，不进） |
| getOutputMime / getOutputExtension | + image/bmp/.bmp、image/gif/.gif |
| pickEncoderKind / EncoderKind | + 'bmp' / 'gif' |
| convertImage | ImageData 懒取逻辑泛化：encoderKind ∈ {avif,tiff,bmp,gif} 才 getImageData；bmp/gif 分支分别调 encodeBmp/encodeGif |
| defaultFormatForInput | + image/svg+xml→'png'、image/heic(-sequence)等→'webp'；`.svg/.heic/.heif` 扩展名兜底同映射（空 MIME 场景） |

## 兼容性 / 回滚

- 新格式均为**纯增量**枚举分支，既有 png/jpeg/webp/avif/tiff/ico 路径不动；默认格式（webp）不变。
- 依赖新增 2 个（gifenc 运行时、libheif-js 运行时懒加载）；回滚 revert 即可，无数据迁移。
- 风险点：libheif-js 浏览器构建的 import 路径/interop 需实现时实测（spike 半小时量级）；若 Emscripten 需要 locateFile，按 @jsquash/avif 的 Vite 处理先例排障。

## 测试设计（node 纯函数层）

1. `encoders/__tests__/bmp.test.ts`：'BM' magic；bfOffBits=122；bfSize 总长；自底向上行序（首像素行在末尾）；RGBA→BGRA 通道序；alpha 保留；宽高回读。
2. `encoders/__tests__/gif.test.ts`：'GIF8' magic；qualityToMaxColors 单调 + 值域 [16,256]（10→16、100→256、33/67 抽样）；同图低质量字节数 ≤ 高质量（抽样断言，量化非严格单调时放宽为 ≤）。
3. `image-convert.test.ts`：pickEncoderKind/getOutputMime/getOutputExtension 新枚举；defaultFormatForInput svg/heic 用例。
4. svg/heic 解码器：浏览器 API 依赖，不做 node 单测（与 decoders/tiff.ts 口径一致），人工验收覆盖。
