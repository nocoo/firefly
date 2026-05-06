# firefly

Modern blog platform. Next.js 16 + Cloudflare D1 + R2. Deployed on Railway.

Migrated from WordPress.

## Documentation

See [docs/](./docs/README.md) for architecture and design documents.

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime & package manager)
- Node.js 20+
- Cloudflare account (for D1, R2, Workers)
- Google OAuth credentials (for admin auth)

### Setup

```bash
# 1. Clone and install
bun install

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your Cloudflare and Google OAuth credentials

# 3. Start dev server
bun run dev          # Webpack dev server (port 7028)
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `CF_ACCOUNT_ID` | ✅ | Cloudflare account ID |
| `CF_API_TOKEN` | ✅ | Cloudflare API token with D1/R2 access |
| `CF_D1_DATABASE_ID` | ✅ | Production D1 database ID |
| `WORKER_URL` | ✅ | D1 proxy Worker URL |
| `WORKER_SECRET` | ✅ | Worker authentication secret |
| `AUTH_SECRET` | ✅ | NextAuth.js secret (32+ chars) |
| `AUTH_URL` | ✅ | Site URL for auth callbacks |
| `AUTH_GOOGLE_ID` | ✅ | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth client secret |
| `AUTH_ALLOWED_EMAILS` | ✅ | Comma-separated allowed admin emails |
| `R2_ACCESS_KEY_ID` | ✅ | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | ✅ | R2 bucket name |
| `R2_PUBLIC_URL` | ✅ | R2 public URL for media |
| `R2_KEY_PREFIX` | | Optional path prefix for R2 keys |

### Testing

```bash
bun run test           # L1: Unit tests
bun run test:watch     # L1: Watch mode
bun run test:coverage  # L1: With coverage report (90% threshold)
bun run test:e2e:api   # L2: API E2E tests
bun run test:e2e:browser # L3: Browser E2E tests (Playwright)
cd worker && vitest run  # Worker: Edge Worker unit tests
```

### Quality System

Six-dimensional testing pyramid:

| Layer | Tests | Description | Trigger |
|-------|-------|-------------|---------|
| **L1** | 1,277 | Unit + Integration (Vitest) | pre-commit |
| **L2** | 191 | API E2E (real HTTP) | pre-push, CI |
| **L3** | 24 | Browser E2E (Playwright) | CI |
| **G1** | - | TypeScript + ESLint | pre-commit |
| **G2** | - | Security (gitleaks, osv-scanner) | pre-push, CI |
| **Worker** | 96 | Edge Worker tests | CI |

Coverage: L1 99%+, L2 100% routes, Worker 100%.

### Git Hooks (Husky)

| Hook | Runs |
|------|------|
| pre-commit | G1 (typecheck + lint-staged) + L1 (unit tests) |
| pre-push | L1 (coverage) + G1 (lint) + L2 (E2E) + G2 (security) |

### CI/CD

GitHub Actions runs four parallel jobs on push/PR:

- **quality**: L1 + G1 + G2 (from [base-ci](https://github.com/nocoo/base-ci))
- **api-e2e**: L2 API E2E (fully local — wrangler dev + filesystem R2)
- **browser-e2e**: L3 Playwright (fully local — wrangler dev + filesystem R2)
- **worker-tests**: Worker unit tests

All jobs must pass before merge.
