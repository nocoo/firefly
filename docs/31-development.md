# 开发、配置与部署

本文说明当前运行入口。功能概览与完整英文说明见[中文 README](../README.md)和[English README](README.en.md)。历史设计文档中的表结构、测试数量、Railway 配置示例与远程测试步骤，需要结合当前源码使用。

## 运行结构

网站、后台、Auth.js、业务 API、MCP 和图片处理位于根 Next.js 包。`worker/` 是独立 Bun 包，用原生 Fetch handler 提供 D1 SQL 代理与 FTS5 搜索；它没有 R2 binding。Next.js 通过 `WORKER_URL` 与 `WORKER_SECRET` 调用 Worker，通过 R2 的 S3 接口上传图片。

`src/data/` 处理数据访问，`src/services/` 编排文章、标签、缓存和索引操作。文章写入后的标签、计数与 FTS 同步属于 best-effort 步骤，失败会记录日志，不会回滚已保存文章；修改这些流程时需同时考虑索引与数据的一致性。

## 首次本地运行

按根 README 分别安装根包与 Worker 包，并将 `.env.example` 复制为根 `.env`。当前完整工具链需要 Node.js 22+。

1. 根 `.env` 设置 `WORKER_URL=http://localhost:8787`、`WORKER_SECRET=test-secret`、`AUTH_URL=http://localhost:7028`，生成自己的 `AUTH_SECRET`。
2. 准备 Google OAuth 客户端，设置 `AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET` 与 `AUTH_ALLOWED_EMAILS`。邮箱允许名单为空时所有账户都会被拒绝。Google 回调为 `http://localhost:7028/api/auth/callback/google`。
3. 在仓库根目录启动本地 Worker，并为开发数据使用独立状态目录：

```bash
./worker/node_modules/.bin/wrangler dev --local \
  --persist-to "$PWD/.wrangler/state/dev" -c worker/wrangler.toml \
  --port 8787 --var WORKER_SECRET:test-secret
```

在另一个终端运行：

```bash
bun run migrate:local
bun run dev
```

本地迁移器固定使用 `http://localhost:8787` 和 `test-secret`，不读取 `.env` 的 Worker URL / secret。请保持两端一致；生产 Worker 应使用独立随机密钥。迁移会创建表、初始设置与默认人类作者，普通开发再从后台维护分类和内容。

当前迁移器按文件记录校验和。`--target local` 经 Worker HTTP 应用 SQL，目标主要是本地初始化与测试；它会移除 PRAGMA 并拆分语句。远程适配器通过 Cloudflare REST API 执行迁移。不要将现有文件重新排序或修改校验和来模拟新迁移。

## 图片与可选服务

普通开发没有通用的本地 R2 开关。图片上传、站点 Logo 与作者头像使用真实 R2，需设置 `CF_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`、`R2_PUBLIC_URL`，可用 `R2_KEY_PREFIX` 区分对象前缀。使用自己的开发存储桶；D1 本地化不会自动改变 R2 去向。

AI 配置保存在站点设置中，由后台填写供应商、模型、认证方式、凭据及可选自定义地址。文章摘要需要有效模型配置；链接元数据可以独立获取，AI 增强失败时会保留可用的原始信息。

人类作者与 AI 作者使用不同的表。管理员可设置默认人类作者与文章署名；AI 作者记录用于展示和 MCP 写作归属，不代表后台 Google 账户。公开作者查询只返回选择公开的人类资料。

评论写入需要管理员会话，目标文章必须公开，站点和文章的评论开关也必须开启。当前不存在普通访客注册或匿名评论提交流程。

## MCP

服务地址为 `https://你的域名/api/mcp`，客户端使用支持 OAuth 的 Streamable HTTP transport。服务对每个 POST 创建独立请求上下文并返回 JSON；GET SSE 与会话终止接口返回 405。

OAuth 使用 Google 管理员会话、邮箱允许名单和 PKCE。完整授权入口和发现端点见 [MCP 设计](11-mcp-server.md)；实际工具由 `src/lib/mcp/server.ts` 和 `entities/` 定义。

| Scope | 当前行为 |
| --- | --- |
| `full` | 文章、标签、分类的管理操作，以及文章摘要、链接信息工具 |
| `author` | 文章操作需要调用方传入有效 AI 作者 `author_id`；内容操作按该作者过滤；新文章固定为 `private` 并使用作者分类；更新不接受发布状态变更。标签可查询与创建，不能修改或删除；不开放分类管理及摘要 / 链接工具 |

`author` 是工具操作范围，不是绑定单一作者身份的多租户账号。令牌不会自动过期，可在 `/admin/mcp` 撤销；刷新时会轮换令牌。首次连接需有可正常完成的 Google 登录配置。

## Backy 备份范围

后台 `/admin/backup` 保存 Backy webhook 与凭据，可主动推送 gzip JSON，也可生成 pull key 供 Backy 调用 `/api/backup/pull`，触发 Firefly 再推送备份。是否定时运行由 Backy 一侧配置。

当前导出包含文章、人类作者、分类、标签及关联、评论、附件元数据、重定向与筛选后的站点设置。它不复制 R2 对象，也不导出 AI 作者表、文章的 AI 作者关联、MCP 令牌、模型密钥或 Backy 密钥。仓库没有与之配套的完整恢复入口；该导出不能单独重建全部站点数据与凭据。具体格式以 `src/data/backup-export.ts` 和 `src/models/backup-schema.ts` 为准。

## 测试环境

| 命令 | 前提与运行资源 |
| --- | --- |
| `bun run test` | 根包单元测试 |
| `bun run test:worker` | 安装 `worker/` 依赖后运行 Worker 单元测试 |
| `bun run test:e2e:api` | 本地 Worker 8787、Next.js 17028；自动迁移 D1 |
| `bun run test:e2e:bdd` | Chromium、本地 Worker 8787、Next.js 27028 |
| `bun run test:e2e` | 顺序运行 API 与浏览器测试，需上述三个端口可用 |

端到端 runner 使用 `worker/.wrangler/e2e-d1` 与 `.wrangler/e2e-r2`，每次先清空对应测试目录。它覆盖 Worker URL / secret，注入 `E2E_SKIP_AUTH` 与 `E2E_TEST_RUNNER`，使 R2 走本地文件、管理会话走测试身份。仅测试 runner 使用这些开关，普通开发与生产配置不应包含它们。

Next.js 端到端测试使用构建后的服务；日志位于 `.wrangler/e2e-logs`。不要并发启动两个 runner，也不要在保留开发 Worker 的 8787 端口上运行测试。这里的会话模拟不能证明真实 Google OAuth、模型服务或生产备份已经连通。

## 部署

当前[公开资料说明](30-social-preview.md)记录博客主域名为 `https://lizheng.blog`，网站由 Railway 托管。仓库 [.github/workflows/ci.yml](../.github/workflows/ci.yml)定义验证工作流，没有网站或 Worker 的 GitHub Actions 自动部署步骤；托管平台上的自动部署设置需另行管理。

自行托管时分别配置：

1. Next.js 网站：安装两处依赖、设置服务端环境变量、执行 `bun run build`，再用 `bun run start` 启动。`AUTH_URL` 使用实际站点地址，并同步 Google 回调和 R2 图片域名。
2. Worker：将 `worker/wrangler.toml` 的 D1 名称与 ID 替换为自己的资源，在该 Worker 设置随机 `WORKER_SECRET`。Next.js 使用相同密钥及实际 Worker URL。
3. 远程 D1 迁移：根 `.env` 的 `CF_ACCOUNT_ID`、`CF_API_TOKEN`、`CF_D1_DATABASE_ID` 决定目标；`bun run migrate` 默认执行生产目标。`bun run migrate:status` 也默认连接生产，并可能创建迁移记录表，不能视为完全只读操作。

在自己的 Cloudflare 资源与配置就绪后，Worker 包使用以下入口发布；这条命令不会自动应用数据库迁移：

```bash
(cd worker && bun run deploy)
```

`scripts/migrations/archive/` 中的 WordPress 导出、图片和旧 URL 处理脚本保留历史迁移过程，不是新实例的通用初始化命令。
