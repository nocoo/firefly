<p align="center">
  <img src="../assets/brand/icon-rounded.png" alt="Firefly" width="128" height="128" />
</p>
<h1 align="center">Firefly</h1>
<p align="center">Write, publish, and organize a personal blog through a web console and AI clients sharing the same content.</p>
<p align="center">
  <a href="https://lizheng.blog">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Firefly powers the personal blog at lizheng.blog, migrated from WordPress. Readers can browse by date, category, tag, or keyword. Site maintainers edit content, manage images, and configure authors through the admin console, with MCP access for AI writing clients.

The website and admin console run in Next.js and access D1 through a separate Cloudflare Worker. The Next.js server uploads images to R2. Administration uses Google sign-in and an email allowlist, suited to a personal site or a small group sharing administrative access.

## Features

- **Reading**: date archives, categories and tags, full-text search across titles / bodies / excerpts, article outlines, image lightboxes, light and dark themes, RSS, sitemaps, and Markdown reading endpoints.
- **Content management**: Markdown posts, draft / published / private / archived states, previews, category ordering, tags, and batch actions. Currently only signed-in administrators can add comments and replies, subject to site and post comment settings.
- **Authors and site identity**: separate human and AI author records, a default human author, avatars, biographies, and post attribution. Human authors can opt into public profile lookup.
- **Images and bookmarks**: a media library, image uploads and post associations, featured images, and reference cards. Fetch link metadata and optionally use AI to prepare titles and descriptions.
- **AI assistance and MCP**: generate excerpts after configuring a model. MCP exposes post, tag, and category operations with full administrative access or a restricted author scope.
- **Maintenance and backups**: traffic analytics, legacy WordPress redirects, Backy backup pushes, and pull triggers. Backups contain content records and attachment metadata, exclude R2 files, and currently have no complete restore endpoint.

## Usage

Open the [blog](https://lizheng.blog) to read, or subscribe to its [RSS feed](https://lizheng.blog/feed.xml). To manage your own instance, open `/admin` and sign in with a Google account listed in `AUTH_ALLOWED_EMAILS`.

On first use, check site identity, the default human author, and categories, then create, preview, and publish a post. Image uploads require configured R2 storage. AI excerpts and enhanced link descriptions require a model and credentials on the AI settings page.

An MCP client supporting OAuth can connect to `https://your-domain/api/mcp` using **Streamable HTTP**, then authorize through the browser. Administrators can inspect and revoke tokens at `/admin/mcp`. Requests using the `author` scope require `author_id`; new posts are forced to private status and are published by an administrator. The `full` scope can manage posts, tags, and categories. See the [development guide](31-development.md) for connection and permission details.

## Development

Install Bun and Node.js 22+; the current Worker toolchain requires Node.js 22. The website and `worker/` are separate Bun packages, so install dependencies in both.

```bash
git clone https://github.com/nocoo/firefly.git
cd firefly
bun install --frozen-lockfile
(cd worker && bun install --frozen-lockfile)
cp .env.example .env
```

Edit the root `.env`:

| Configuration | Local development values |
| --- | --- |
| `WORKER_URL`, `WORKER_SECRET` | `http://localhost:8787`, `test-secret`, matching the local Worker and migration adapter below |
| `AUTH_SECRET`, `AUTH_URL` | Your generated session secret, `http://localhost:7028` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_EMAILS` | A Google OAuth client and allowed email addresses; callback: `http://localhost:7028/api/auth/callback/google` |
| `CF_ACCOUNT_ID`, `R2_*` | Your R2 bucket, S3 credentials, and public asset URL for image uploads; see the environment template |

`CF_API_TOKEN` and `CF_D1_DATABASE_ID` are used for remote migrations and are unnecessary for local D1 initialization. R2 uploads during ordinary development still use the configured remote bucket. Only the test runner uses the local filesystem adapter.

Start the local Worker from the repository root and leave this terminal running:

```bash
./worker/node_modules/.bin/wrangler dev --local \
  --persist-to "$PWD/.wrangler/state/dev" -c worker/wrangler.toml \
  --port 8787 --var WORKER_SECRET:test-secret
```

In another terminal at the repository root, initialize local D1 and start the website:

```bash
bun run migrate:local
bun run dev
```

Open `http://localhost:7028`. `migrate:local` always connects to local port 8787 using `test-secret`; that value is only for this local workflow. `bun run migrate` defaults to production, so configure your own resources before self-hosting.

| Command / path | Purpose |
| --- | --- |
| `bun run build`, `bun run start` | Type-check and build the website; run the production website |
| `bun run typecheck`, `bun run lint` | Website and Worker type and code checks |
| `src/app/` | Blog, admin console, HTTP APIs, and MCP endpoints |
| `src/data/`, `src/services/` | Data access and content operations |
| `worker/src/` | Native Fetch Worker, D1 SQL proxy, and full-text search |
| `scripts/migrations/` | Current database migrations; `archive/` retains WordPress migration scripts |

Existing deployment documentation records Railway as the website host. GitHub Actions in this repository defines CI; website hosting, Worker publication, and remote database migrations are configured separately. See the [development and deployment guide](31-development.md).

## Tests

Install dependencies in both the root and `worker/` first:

```bash
bun run test
bun run test:worker
bun run test:e2e:api
```

The first two commands run website and Worker unit tests. The API runner starts a local Worker and Next.js, applies migrations, and uses local files as an R2 substitute. Keep ports 8787 and 17028 available.

```bash
bunx playwright install chromium
bun run test:e2e:bdd
```

The browser runner uses ports 8787 and 27028. Both end-to-end runners share and recreate `worker/.wrangler/e2e-d1` and `.wrangler/e2e-r2`; run them sequentially, with port 8787 available before starting. The runner injects a test session. Real Google sign-in, external model calls, and production backup delivery are outside these suites' validation scope.

## Stack

| Technology | Purpose |
| --- | --- |
| TypeScript, Bun | Application code, scripts, and dependency management |
| Next.js, React | Blog, admin console, and server APIs |
| Tailwind CSS | Page styling and themes |
| Cloudflare Workers, D1 / SQLite FTS5 | Data access, Chinese word segmentation, and full-text search |
| Cloudflare R2, AWS S3 SDK | Image storage and uploads |
| Auth.js | Google sign-in and administrative sessions |
| MCP SDK, Zod | AI client protocol and input validation |
| Vercel AI SDK, next-ai | Model configuration, excerpts, and link text generation |
| Vitest, Playwright | Unit, HTTP, and browser tests |

## Documentation

- [Documentation index](README.md)
- [Development, configuration, and deployment](31-development.md)
- [Data and service architecture](03-architecture.md)
- [MCP connection protocol](11-mcp-server.md) and [entity tool framework](16-mcp-framework.md)
- [Media library](18-media-library.md) and [image handling](19-image-optimization.md)
- [Human authors](28-human-authors.md) and [public site identity](30-social-preview.md)

## License

[MIT](../LICENSE).
