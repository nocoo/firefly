# Railway to jp2 Migration

Status: implementation authorized; production domain cutover requires a separate
owner approval. Baseline: `d68c10b`, application version `2.17.1`.

## Boundaries

- Deploy one native Next.js/Node container on jp2. Keep the existing SQL Worker,
  D1 database, R2 bucket, public URLs, Google authentication and MCP scopes.
- Use successful `main` push CI as the Docker CD trigger, as Ellie does. A GitHub
  Release alone is not evidence that the image has been deployed.
- Do not switch `lizheng.blog`, `origin.lizheng.blog` or `www.lizheng.blog`, stop
  the Railway service, deploy the Worker, apply migrations, or mutate production
  content during pre-cutover acceptance.
- Railway production variables are authoritative. Transfer application values
  unchanged through a private channel; never use local `.env` values as their
  replacement, print secrets, put them in images, or copy them into fixtures.
- Keep production TLS and shared Caddy changes behind the cutover review where
  they require certificate work or a shared-proxy restart. Private origin checks
  are sufficient to stage the container, but are not public cutover proof.

## Target

| Item | Target |
| --- | --- |
| Image | `ghcr.io/nocoo/firefly`, deployed by digest |
| GitHub environment | `firefly / production` |
| Host directory | `/opt/firefly` |
| Compose service / container | `web` / `firefly-app` |
| Internal port | `7028` |
| Runtime | One Node process; standalone output with static and public assets |
| Storage | Existing external D1/R2; disposable application cache |

The capacity check on 2026-10-21 found 2 vCPU, 15.56 GiB RAM and a 61 GiB root
filesystem. Retained sysstat samples had at least 13.50 GiB available RAM;
Firefly's Railway seven-day maximum was about 970 MB. These observations do not
replace image-processing, backup or cold-start acceptance. Build images in CI,
not on jp2; host I/O has occasional maintenance-related peaks.

Railway's actual `NODE_OPTIONS` permits a 6144 MiB heap. The initial container
therefore retains its 8 GiB Railway memory ceiling instead of applying the earlier
2 GiB planning budget. This is a limit, not a reservation; tuning it is separate
from preserving the migration's environment contract.

## Implementation and Atomic Commits

1. Record this plan and the explicit approval boundary.
2. Add standalone image packaging and the smallest runtime-rendering changes
   needed to build without a production database. Preserve explicit public data
   caching and all authentication checks. Cover packaging and rendering rules.
3. Add the Docker CD caller, Compose configuration and bounded deployment
   verification. Preserve the current CI lanes and add container/workflow checks.
4. Bootstrap the private jp2 application, transfer and compare Railway variables,
   configure scoped GitHub deployment credentials, and publish the migration
   version through normal hooks and successful exact-SHA CI.
5. Record pre-cutover evidence and ask the owner to review. Do not proceed to
   public routing, certificate changes or Railway retirement without approval.

Expected files include `next.config.ts`, `Dockerfile`, `.dockerignore`, rendering
entrypoints only where necessary, `.github/workflows/ci.yml`,
`.github/workflows/release.yml`, deployment scripts/tests, `deploy/compose.yaml`,
this guide and the root handbook. Do not copy Ellie's dual-app structure or its
unrelated Bun build workaround.

## Build and Verification Contract

The existing build can access site settings during prerendering
(`src/app/layout.tsx`; `Retrospective.md`, 2026-10-16). Do not work around that by
embedding production credentials, baking test content into pages, disabling the
public cache, or shipping E2E authentication switches. Public build configuration
such as the R2 image origin must match production; runtime secrets must not be
build inputs.

Reuse `nocoo/base-ci/.github/workflows/deploy-docker.yml` at the inspected commit
`0394178ebcff0418c442d84a84119220f31f8987`. It verifies successful main CI, rechecks
the source before deployment, records image digests, and deploys those digests.
Its remote verification runs after replacement: failure does not automatically
restore the old container. Deployment records live in `.base-ci-releases/`.

Required evidence:

- L1: root and Worker unit coverage, both type lanes, strict Biome and existing
  AST/skip gates. Preserve all thresholds and normal commit/push hooks.
- L2: isolated real HTTP/D1/R2 tests, including content/cache invalidation and
  authorization failures; no shared development or production resets.
- L3: critical browser journeys with the existing isolated runner. Real Google
  login remains a distinct acceptance item, not something mocks prove.
- Container: clean Linux image build, native Sharp loading, static/public assets,
  no production secrets or test flags, and actual standalone startup.
- Private origin: expected version, image digest/revision, D1 health, read-only
  public pages/images/exports where authorized, and unauthenticated write denial.
- Public origin after approval: expected jp2 origin identity and version, correct
  forwarding/TLS behavior, real Google login and MCP authorization, then writes.

Never accept an old Railway response as evidence for the new origin. During
pre-cutover CD, make private-origin verification explicit; any public-verification
phase must fail closed if its target or origin identity is missing.

## Cutover and Rollback (Not Yet Authorized)

Before changing routing, capture the current DNS/origin configuration, Railway
deployment, active/new image digests, and a rollback procedure. Confirm the
certificate covers `lizheng.blog`; unrelated wildcard certificates do not.

Freeze administrative/MCP writes briefly and cold-start the jp2 application so
its independently warmed caches cannot retain changes made through Railway while
staging. Switch the intended public origin, verify jp2 identity and all critical
flows, then resume writes. Keep only one
active write origin. Change CD verification to the public target only after the
switch; retain Railway for the agreed rollback window without leaving an
uncontrolled alternate write endpoint.

Rollback uses the recorded previous digest or the retained Railway deployment,
not `latest` and not a rebuild. Clear stale origin caches before resuming writes.
Application rollback does not reverse database state. This migration deliberately
contains no schema or data migration.

## Progress

- [x] Owner selected jp2 and main-CI-triggered CD.
- [x] Host capacity and pinned shared deployment workflow inspected.
- [x] Database-independent standalone build and image verified locally (Linux amd64).
- [x] CI/CD and deployment verification implemented and independently reviewed.
- [x] All 17 Railway application variables matched both the private environment file and the running container; no values were printed.
- [x] Migration version `v2.18.0` published; exact-SHA CI/CD passed.
- [x] Private jp2 origin acceptance completed.
- [ ] Owner reviewed evidence and approved production domain cutover.
- [ ] Public cutover, acceptance and rollback-window closure completed.

### Local evidence, 2026-10-21

- The image built without Worker credentials or a database endpoint, and native
  Sharp generated a PNG in the non-root runtime stage. The local-only dependency
  installation used an approved mirror; CI builds the canonical Dockerfile.
- A bare image ran as UID 1000 with no secret/test environment variables. Health
  failed closed with 503 without the database configuration, protected reads and
  writes returned 401, static assets returned 200, and the E2E file route returned
  404. This is packaging proof, not production database or OAuth proof.
- GitHub's scoped deployment environment was created with the existing jp2 SSH
  authorization and registry pull credentials. No host access policy changed.
- The initial shell wrapper used zsh's read-only `status` name after Docker had
  already succeeded. The completed build log and resulting image were inspected
  instead of treating the wrapper error as a failed image or rebuilding blindly.

### Initial staging receipt, 2026-10-21

| Evidence | Result |
| --- | --- |
| Release | `v2.18.0`, `84708c3d01e4a3b391f5664ea3eeed6a172a5d09` |
| CI | [39539639334](https://github.com/nocoo/firefly/actions/runs/39539639334), all enabled jobs successful |
| Docker CD | [39539959171](https://github.com/nocoo/firefly/actions/runs/39539959171), successful |
| Image | `ghcr.io/nocoo/firefly@sha256:86a80abc2f9412019b517418c5a731e7996bb12357fa7155a47db2f033a90a62` |
| Private binding | `127.0.0.1:17028` on jp2, container `firefly-app`, healthy |
| Environment | All 17 Railway application variables matched the running container; only `RAILWAY_*` platform variables were omitted |
| Cache | Runtime UID 1000 owned the populated fetch-cache directory; no `EACCES` was observed |
| Public site | Still Railway `2.17.1`; its GitHub deployment trigger was removed without stopping the active deployment |

Local checks passed 1,860 root tests and 109 Worker tests, both configured
four-metric coverage thresholds, strict lint/types and security. Local API tests
passed 204 cases with 2 pre-existing TODOs; 4 real-cache cases passed. Browser
tests passed 153 cases with 44 pre-existing conditional skips. The new Linux
container CI lane independently passed the same 204 API and 4 cache cases using
the image's native cache directory, not a replacement tmpfs.

Private production-data reads passed for the homepage, a published article,
Markdown export, Next image optimization, RSS, sitemap/XML stylesheet, llms,
robots and login. The Google provider retained its canonical callback URL.
SSH-forwarded desktop/mobile browser checks had no page errors, and screenshots
were inspected. No authenticated production writes or complete Google OAuth
login were exercised; these remain explicit cutover acceptance items.

Deployment controls (`DEPLOY_PHASE`, `DEPLOY_URL`, `DEPLOY_ORIGIN_MARKER`) are
repository variables so the reusable-workflow caller can resolve them. Credentials
remain scoped to the `firefly / production` environment. The phase is still
`precutover`; missing or invalid phase values fail closed.

Rollback metadata is private at `/opt/firefly/railway-rollback.json`, and Docker
receipts are in `/opt/firefly/.base-ci-releases/`. Neither production DNS nor
shared Caddy/TLS configuration has changed. The owner has not approved cutover.
