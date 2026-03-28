# firefly

Modern blog platform. Next.js 16 + Cloudflare D1 + R2. Deployed on Railway.

Migrated from WordPress (lizheng.me).

## Documentation

See [docs/](./docs/README.md) for architecture and design documents.

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime & package manager)
- Node.js 20+

### Setup

```bash
bun install
bun run dev          # Start dev server (Webpack, port 7043)
```

### Testing

```bash
bun run test           # Run all unit tests
bun run test:watch     # Watch mode
bun run test:coverage  # Run with V8 coverage report
```

Coverage thresholds are enforced at **90%** for lines, functions, branches, and statements.

### Linting

```bash
bun run lint           # ESLint
```

### Git Hooks (Husky)

Husky hooks are checked into `.husky/` and shared across the team:

| Hook        | Runs                                               |
| ----------- | -------------------------------------------------- |
| pre-commit  | G1 (typecheck + lint-staged) + L1 (unit tests)     |
| pre-push    | L1 (coverage ≥90%) + G1 (lint) + L2 (E2E) + G2 (security) |

Hooks are installed automatically via the `prepare` script on `bun install`. Do not skip hooks — all commits must pass tests, and all pushes must also pass lint.
