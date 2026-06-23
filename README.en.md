<div align="center">

# DevTools

**A developer toolbox that runs entirely in your browser**

40 everyday developer tools, computed locally — no login, no data upload

[🌐 Live](https://tools.baixuanz.cn) · [中文](./README.md)

</div>

---

## Features

- **Instant** — the page *is* the tool, with the primary input autofocused; from "I need a tool" to a result in under 5 seconds
- **Local-only** — every operation runs in your browser; no backend, no uploads, works offline
- **Zero setup** — no login, install, or configuration; privacy-respecting
- **Lightweight** — < 50KB gzipped JS per tool page, hydration on demand, Lighthouse Performance ≥ 90
- **Chinese-first** — UI, error messages, and SEO tuned for Chinese developers

## Tool Catalog

**40 tools across 12 categories**, organized as `/category/tool-name`.

| Category | Highlights |
| --- | --- |
| Encoding | Base64 · URL · JWT encode/decode |
| Crypto & Hash | Hash · symmetric encryption · SM2/SM4 (Chinese national standards) |
| Date & Time | Timestamp conversion · Cron expression parsing |
| Formatting | JSON format/diff · JSON ↔ XML / YAML |
| Network | Device & UA parsing · HTTP status codes · IPv4 subnet calculator |
| Text | UUID · random string |
| Media | QR code generate & read · image format conversion |
| Others | Regex · color · CSS · Markdown editor · Docker config conversion |

> Full list at [tools.baixuanz.cn](https://tools.baixuanz.cn). The registry lives in `src/data/tools.ts`.

## Tech Stack

- **Framework** — Astro 6 (SSG) + Vue 3 (tool interactions) + Alpine.js (global shell)
- **Styling** — Tailwind CSS v4 with centralized design tokens
- **Language** — TypeScript (strict)
- **Accessible primitives** — Headless UI (Vue)
- **Heavy compute** — Web Workers keep the main thread free
- **Tooling** — pnpm · Node ≥ 22.12

## Getting Started

```sh
pnpm install
pnpm dev        # http://localhost:4321
```

| Command | Action |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Build for production to `./dist/` |
| `pnpm preview` | Preview the build locally |
| `pnpm test` | Run Vitest tests |
| `pnpm astro check` | TypeScript diagnostics |

## Project Structure

```text
src/
├── layouts/      # page shells (Layout, ToolLayout)
├── pages/        # file-based routes
├── tools/        # tool pages grouped by category (encoding/, crypto/ …)
├── components/   # reusable components (.vue interactive + .astro static)
├── composables/  # Vue composables
├── data/         # tool registry & FAQ
├── utils/        # utilities & web workers
└── styles/       # design tokens
```

## Deployment

A static site deployable to any static host:

- **EdgeOne Pages** — primary site [tools.baixuanz.cn](https://tools.baixuanz.cn)
- **GitHub Pages** — built and deployed via GitHub Actions (see `.github/workflows/`)

## License

[MIT](./LICENSE)
