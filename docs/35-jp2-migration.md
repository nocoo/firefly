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

Freeze administrative/MCP writes briefly, switch the intended public origin,
verify jp2 identity and all critical flows, then resume writes. Keep only one
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
- [ ] Database-independent standalone build and image verified.
- [ ] CI/CD and deployment verification implemented and reviewed.
- [ ] Railway variables securely transferred and equality verified.
- [ ] Migration version published; exact-SHA CI/CD passed.
- [ ] Private jp2 origin acceptance completed.
- [ ] Owner reviewed evidence and approved production domain cutover.
- [ ] Public cutover, acceptance and rollback-window closure completed.
