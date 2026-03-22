# 03 — Architecture & Tech Stack

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                       │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ CDN/Cache│  │ R2 (images)   │  │ D1 (database)    │  │
│  │          │  │ lizhengblog   │  │ lizhengme-db     │  │
│  │          │  │ 2035 files    │  │ lizhengme-db-test│  │
│  └──────────┘  └───────────────┘  └──────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │   Railway (Compute) │
          │                     │
          │  Next.js 16 App     │
          │  ┌───────────────┐  │
          │  │ Public Pages  │  │  ← SSR/ISR, SEO-optimized
          │  │ /YYYY/MM/slug │  │
          │  │ /category/    │  │
          │  │ /tag/         │  │
          │  ├───────────────┤  │
          │  │ Admin Panel   │  │  ← Auth-gated, basalt design
          │  │ /admin/posts  │  │
          │  │ /admin/editor │  │
          │  │ /admin/stats  │  │
          │  ├───────────────┤  │
          │  │ API Routes    │  │  ← D1 REST via binding
          │  │ /api/posts    │  │
          │  │ /api/auth     │  │
          │  │ /api/analytics│  │
          │  └───────────────┘  │
          └─────────────────────┘
```

## Tech Stack

### Runtime & Framework

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Runtime | Bun | latest | Fast build, native TS, workspace support |
| Framework | Next.js | 16.x | App Router, RSC, ISR, Turbopack |
| Language | TypeScript | 5.x | Strict mode, exactOptionalPropertyTypes |
| Styling | Tailwind CSS | 4.x | @tailwindcss/postcss, CSS variables |
| UI Components | shadcn/ui (basalt variant) | — | Copy-paste from ../basalt, Radix primitives |
| Icons | Lucide React | latest | 1.5px stroke, consistent with basalt |
| Editor | TBD (Phase 1: basic) | — | Markdown with live preview |

### Data Layer

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Database | Cloudflare D1 | SQLite at edge, free tier generous, zero-config |
| Object Storage | Cloudflare R2 | Already has blog images, S3-compatible |
| D1 Access | REST API from Railway | Railway → D1 via Cloudflare API |
| ORM | None (raw SQL) | D1 works best with raw SQL, keeps control |

### Auth

| Component | Technology |
|-----------|-----------|
| Provider | Google OAuth |
| Library | Auth.js (NextAuth v5) |
| Strategy | JWT (stateless, no session table needed) |
| Whitelist | Email whitelist in env var (single user initially) |

### Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| Compute | Railway | Docker (Bun build → Node runtime) |
| Database | Cloudflare D1 | `lizhengme-db` (prod) / `lizhengme-db-test` (test) |
| Images | Cloudflare R2 | `lizhengblog` bucket, custom domain |
| DNS | Cloudflare | lizheng.me |
| CI/CD | Railway auto-deploy | From GitHub main branch |

### Quality (6-dimensional)

| Dimension | Tool | Gate |
|-----------|------|------|
| L1 Unit | Vitest, ≥90% coverage | pre-commit |
| L2 Integration | Custom HTTP E2E vs D1-test | pre-push |
| L3 System | Playwright | CI |
| G1 Static | tsc --noEmit + ESLint strict | pre-commit |
| G2 Security | osv-scanner + gitleaks | pre-push |
| D1 Isolation | lizhengme-db-test (separate D1) | E2E only |

## Architecture Patterns

### MVVM (following basalt/pew conventions)

```
src/
├── models/          ← Pure types, validators, business logic (no React)
│   ├── types.ts     ← Shared interfaces (Post, Category, Tag, Comment)
│   ├── post.ts      ← Post validation, slug generation, reading time
│   └── analytics.ts ← Bot detection, stats aggregation
├── viewmodels/      ← React hooks composing models + data fetching
│   ├── usePostsViewModel.ts
│   ├── useEditorViewModel.ts
│   └── useAnalyticsViewModel.ts
├── data/            ← Data access layer (D1 queries)
│   ├── db.ts        ← D1 client setup
│   ├── posts.ts     ← Post CRUD queries
│   └── analytics.ts ← Analytics queries
├── app/             ← Next.js App Router pages
│   ├── (public)/    ← Public blog pages (SSR/ISR)
│   ├── (admin)/     ← Admin panel (client-side, auth-gated)
│   └── api/         ← API routes
├── components/      ← React components
│   ├── ui/          ← shadcn/ui primitives (from basalt)
│   ├── blog/        ← Blog-specific components
│   └── admin/       ← Admin-specific components
└── lib/             ← Utilities
    ├── auth.ts      ← Auth.js config
    ├── r2.ts        ← R2 client for image management
    ├── seo.ts       ← Meta tag generation
    └── bot.ts       ← Bot/crawler detection
```

### D1 Access Pattern (Railway → Cloudflare D1)

Since Next.js runs on Railway (not Cloudflare Workers), we access D1 via REST API:

```typescript
// data/db.ts
const D1_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const res = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  return data.result[0].results;
}
```

### SEO Strategy

1. **Server-side rendering** for all public pages
2. **Structured data** (JSON-LD): BlogPosting, BreadcrumbList, WebSite
3. **Meta tags**: title, description, canonical, Open Graph, Twitter Cards
4. **sitemap.xml**: Auto-generated from published posts
5. **robots.txt**: Allow all legitimate crawlers
6. **llms.txt**: AI-crawler-friendly site summary
7. **RSS feed**: Full content feed at /feed.xml
8. **301 redirects**: From all old WordPress URLs

### AI Crawler Support

Explicit support for AI crawlers:
- `llms.txt` at root with site description and content index
- Proper `User-Agent` detection for GPTBot, ClaudeBot, Google-Extended, etc.
- Track AI crawler visits separately in analytics
- Serve clean, semantic HTML (no JS-rendered content for bots)

### Image Handling

R2 bucket `lizhengblog` already has 2,035 files (529MB).
Keep original R2 keys (`wp-content/uploads/YYYY/MM/filename.ext`) unchanged.
Bind `assets.lizheng.me` custom domain → R2 bucket to serve images directly.

New image uploads go through admin panel → API route → R2 PUT.
