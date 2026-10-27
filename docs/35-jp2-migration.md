# Railway to jp2 Migration

Status: owner approved the production cutover on 2026-10-21. Both public origins
were verified on jp2 at 05:54:39 UTC with application version `2.18.0`. Railway
is stopped and retained for rollback; project deletion is not authorized.
Migration baseline: `d68c10b`, application version `2.17.1`.
The owner subsequently approved retiring the duplicate `origin.lizheng.blog`;
only the canonical apex now routes to Firefly. The retirement section below
supersedes the historical two-host cutover and its original DNS rollback scope.

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

Current Docker CD (post–jp4 path migration) uses host directory `/data/firefly` on
Tailscale jp4. The table below records the jp2 cutover target; rollback artifacts
under `/opt/firefly` on jp2 remain historical.

| Item | Target |
| --- | --- |
| Image | `ghcr.io/nocoo/firefly`, deployed by digest |
| GitHub environment | `firefly / production` |
| Host directory (jp2 cutover) | `/opt/firefly` |
| Host directory (current CD) | `/data/firefly` on jp4 |
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
`ac635753a869cb85fad1f52aae4ccbd6119f3cae`. It verifies successful main CI, rechecks
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

## Cutover and Rollback

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
- [x] Owner reviewed evidence and approved production domain cutover.
- [x] Public cutover, health checks and existing-session acceptance completed.
- [ ] Fresh Google OAuth and authenticated MCP/write acceptance completed.
- [ ] Owner closed the rollback window and authorized Railway project deletion.

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
remain scoped to the `firefly / production` environment. At that checkpoint the phase was
`precutover`; missing or invalid phase values fail closed.

Rollback metadata is private at `/opt/firefly/railway-rollback.json`, and Docker
receipts are in `/opt/firefly/.base-ci-releases/`. This staging checkpoint preceded
the separately approved public cutover below.

### Approved public cutover, 2026-10-21

- At cutover, apex and `origin` used proxied CNAME records targeting `jp2.nocoo.cloud`.
  The independent `www` redirect Worker and mail records are unchanged.
- A scoped Origin CA certificate covers only the two blog hostnames. Its private
  key was generated and retained on jp2, mode 0600. Caddy requires the existing
  shared Cloudflare origin-pull CA and adds `X-Firefly-Origin: jp2`.
  Cloudflare uses `ssl=strict`, `tls_client_auth=on`; custom-certificate zone-level
  AOP remains disabled. These are distinct API settings, not interchangeable.
- The Caddy candidate passed validation before one shared-proxy restart. All six
  existing hosts returned 200 afterward. Direct unauthenticated origin TLS was
  rejected; Cloudflare ingress succeeded.
- `deploymentStop` acknowledged success but left Railway running. `railway down`
  actually stopped deployment `29946042-b67a-41d9-9003-e37e3420181a`: instance and
  deployment `REMOVED`, `deploymentStopped=true`, `canRedeploy=true`,
  `canRollback=true`. Project, variables and old image record remain;
  the GitHub trigger stays disconnected.
- Firefly was cold-restarted after the old instance stopped, rotating its cache
  epoch before DNS switched. No schema, data, Worker deployment or application
  secret changed. All 17 Railway application variables again matched the container.
- Initial ingress returned 520 because the wrong AOP toggle was selected.
  Correcting it restored both origins at 05:54:39 UTC. See `Retrospective.md`;
  this was not a zero-interruption cutover.

The cutover image was
`ghcr.io/nocoo/firefly@sha256:8fc87af34b5c44a565171b43d742ed2fbf5bbbc4afe6d9f04b9e1a8d64d54df5`,
revision `cac904747d6942930df562c889d313703221b565`, with successful exact-revision
[CI](https://github.com/nocoo/firefly/actions/runs/39541102780) and
[CD](https://github.com/nocoo/firefly/actions/runs/39541395052). Subsequent main
pushes produce their own receipts; consult Actions and `.base-ci-releases/`
rather than treating this cutover image as permanently current.

Public checks passed for no-store health/version/origin/D1, homepage, published
article, archive, static chunks, optimized R2 image, RSS, sitemap/XSL, llms,
robots, login and canonical Google callback configuration. Unauthenticated admin
reads, post writes and MCP tool-list requests returned 401. The existing Chrome
session survived and displayed the dashboard and authenticated article list.
Chrome also reported a recoverable React #418 hydration error and blocked the
Cloudflare analytics beacon under the existing CSP; the article list subsequently
rendered. This is not a clean-console claim or proof of a fresh OAuth exchange or
authenticated production writes. Do not broaden CSP or change auth to hide it.

Kuma reported the existing health monitor up with valid TLS. Hexly's real scheduled
probe observed 2.18.0 as operational after cutover. No monitoring target changes
or synthetic heartbeats were needed. CD now uses `DEPLOY_PHASE=production` and
`DEPLOY_URL=https://lizheng.blog`, retaining `DEPLOY_ORIGIN_MARKER=jp2`.

### Retained rollback procedure

Private before-images are in `/opt/firefly/cutover-20261021/`, including DNS,
SSL/AOP, Caddy and Railway metadata. The original global `tls_client_auth` value
was `off`; custom zone-level AOP was disabled. Runtime secrets remain in
`/opt/firefly/.env.runtime`.

1. Stop `firefly-app` to freeze writes and record its digest. Never keep two
   independent application write origins running.
2. For image rollback, use a previously accepted digest with the normal Compose
   interpolation/override contract and cold-start it. Never use `latest` or bare
   Compose without `IMAGE_SHA`.
3. For Railway rollback, check the recorded deployment remains restorable under
   the plan's retention policy, then use the inspected GraphQL operation
   `deploymentRedeploy(id: ..., usePreviousImageTag: true)`, not a source rebuild.
   Verify its health and canonical custom-domain attachment before restoring
   only the apex DNS target from the private snapshot. Do not recreate the retired
   `origin` alias. Restore original TLS settings if needed. Inspect instance
   state and responses, not just successful command exits.
4. Verify the intended public origin and authentication before resuming writes;
   leave the other origin stopped. Database writes are not undone by routing or
   image rollback. Delete the Railway project only after owner approval.

### Duplicate origin retirement, 2026-10-21

The owner requested checking dependencies and removing `origin.lizheng.blog`.
An exact-host scan of personal-workspace source/configuration files found only
this migration history. Existing Codex, Claude, Gemini, OpenCode and Pi client
configurations and the running Firefly environment contained no alias reference.
Cloudflare had no zone Worker routes, legacy Page Rules, custom routing rulesets
or DNS records targeting the alias. The only Worker custom domain in the zone
was the independent `www` redirect. Railway's service-instance API returned no
active deployments or custom-domain attachments, so no Railway mutation was
needed. This bounded configuration inventory is not proof that no unknown
external client ever used the public alias.

Removed the duplicate hostname from Caddy, its proxied CNAME, and the obsolete
`_railway-verify.origin.lizheng.blog` TXT. The candidate Caddy configuration passed
validation, then `SIGUSR1` reloaded the file-backed configuration. The container's
start time did not change. Loaded-config inspection confirmed the alias was gone;
before DNS removal, its requests returned an empty unmatched-host response rather
than Firefly content. All other DNS records compared unchanged. The shared Origin
CA certificate/key were retained because the certificate also serves the apex;
a retained SAN does not create a DNS record or an application route.

Main health remained no-store, jp2, version 2.18.0 and database-connected. The six
other Caddy sites remained reachable, including their normal redirects, and
`www` retained its 301 to the apex. Before-images and a completion receipt are
private at `/opt/firefly/retire-origin-20261021/`. Old migration backups describe
historical routing and must not be restored wholesale.
