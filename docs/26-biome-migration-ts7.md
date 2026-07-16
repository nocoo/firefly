# 26 — Biome migration + TypeScript 7 upgrade

> **Status: implemented** (2026-07-16)
>
> 淘汰 `typescript-eslint` / ESLint，改用 **Biome 2.5.3**；TypeScript 升到
> 稳定版 **`7.0.2`**。根包安装 `@typescript/native-preview@7.0.0-dev.20260707.2`
> 供 Next 16 识别并跳过其内嵌 typecheck；真正的 typecheck / build 一律走
> stable `tsc`。参考实现：`../pew` doc 44。

## 为什么

- `typescript-eslint@8.x` peer 上限 `typescript <6.1.0`，装不上 TS 7。
- Biome 与 tsc 版本解耦；G1 冷启动从数秒级 ESLint 降到亚秒级 Biome。
- 自研 gate（`oxc-parser`）补齐 biome 缺的 `no-dynamic-delete` 与
  `@ts-expect-error` 描述长度。

## 目标形态

| 项 | 值 |
|---|---|
| `typescript` | `7.0.2`（root + worker） |
| `@typescript/native-preview` | `7.0.0-dev.20260707.2`（root only，Next marker） |
| `@biomejs/biome` | `2.5.3` |
| `oxc-parser` | `0.139.0`（pin exact） |
| `build` | `tsc --noEmit && next build --webpack` |
| `lint` | `typecheck && biome check … && gate:*` |
| Next `@/*` paths | Explicit `webpack.resolve.alias` in `next.config.ts` — TS 7 has no `lib/typescript.js`, so Next cannot read `tsconfig.paths` itself |

移除：`eslint`、`@eslint/js`、`typescript-eslint`、`eslint-plugin-react-hooks`、
`eslint.config.mjs`。

## 规则取舍（相对旧 ESLint）

- **对齐 strict**：`noNonNullAssertion` / `noExplicitAny` / `useImportType` 等
  顶层 error；测试文件 override 放宽 `any` / `!`。
- **`.skip` / `.only`**：unit 用 `noSkippedTests` + `noFocusedTests`；
  `e2e/**` 关闭 `noSkippedTests`（保留 L3 条件 `test.skip(condition, reason)`）。
- **自研 gate**：`scripts/check-dynamic-delete.ts`、
  `scripts/check-ts-expect-error.ts`（`FIREFLY_GATE_ROOT` 支持 pre-commit 扫 INDEX）。
- **明确关闭**（产品形态或旧 eslint 未覆盖，避免 suppress 泛滥）：
  - `noDangerouslySetInnerHtml`（JSON-LD + sanitize 后的 markdown HTML）
  - `noImgElement`（动态/外链图；Next Image 不适用场景多）
  - 若干 a11y 噪声规则、CSS `@import` 顺序等

## 验证

- `bun run lint` 全绿
- L1：1448 passed；coverage statements 99.89% / branches 99.3% / lines 100%
- Worker：99 passed
- `rg -c eslint` 业务代码 0（仅历史 docs + gate 脚本注释对照）
