<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Firefly" width="128" height="128" />
</p>
<h1 align="center">Firefly</h1>
<p align="center">写作、发布和整理个人博客，让网页后台与 AI 客户端共用一套内容。</p>
<p align="center">
  <a href="https://lizheng.blog">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Firefly 是 lizheng.blog 使用的个人博客系统，由 WordPress 迁移而来。读者可以按时间、分类、标签或关键词阅读文章；站点维护者通过后台编辑内容、管理图片、设置作者，也可以让 AI 客户端通过 MCP 协助写作。

网站与管理后台运行在 Next.js 中，通过独立 Cloudflare Worker 访问 D1。图片由 Next.js 服务端上传到 R2。后台使用 Google 登录和邮箱允许名单，适合个人站点或共用管理权限的小范围协作。

## 功能

- **文章阅读**：时间归档、分类与标签、标题 / 正文 / 摘要全文搜索、文章目录、图片灯箱、浅色与深色主题，以及 RSS、站点地图和 Markdown 阅读入口。
- **内容管理**：Markdown 文章、草稿 / 公开 / 私有 / 归档状态、预览、分类排序、标签和批量操作。评论与回复目前由已登录管理员发布，并受站点及文章的评论开关控制。
- **作者与站点资料**：分别管理人类作者和 AI 作者，设置默认人类作者、头像、介绍与文章署名；人类作者可选择公开资料查询。
- **图片与链接收藏**：媒体库、图片上传及文章关联、封面图、外部链接卡片；可读取链接元数据，并按配置使用 AI 整理标题和描述。
- **AI 辅助与 MCP**：配置模型后生成文章摘要；MCP 提供文章、标签、分类操作，并区分完整管理权限和受限作者权限。
- **维护与备份**：流量统计、WordPress 旧链接重定向、Backy 备份推送及拉取触发。备份包含内容记录与附件元数据，不包含 R2 文件，当前没有完整恢复入口。

## 使用

打开[博客](https://lizheng.blog)即可阅读，也可以订阅 [RSS](https://lizheng.blog/feed.xml)。管理自己的实例时，进入 `/admin`，用 `AUTH_ALLOWED_EMAILS` 中的 Google 账户登录。

首次使用后台时，先检查站点资料、默认人类作者和分类，再创建文章、预览并发布。图片上传需要配置 R2；AI 摘要和链接增强需要在 AI 设置页填写模型及凭据。

支持 OAuth 的 MCP 客户端可连接 `https://你的域名/api/mcp`，选择 **Streamable HTTP**，再通过浏览器授权。管理员可在 `/admin/mcp` 查看和撤销令牌。`author` 权限的请求需要指定 `author_id`，新文章固定为私有，发布由管理员处理；`full` 权限可管理文章、标签和分类。连接方式和权限范围见[开发指南](docs/31-development.md)。

## 开发

安装 Bun 和 Node.js 22+；当前 Worker 工具链要求 Node.js 22。网站与 `worker/` 是两个独立的 Bun 包，需要分别安装依赖。

```bash
git clone https://github.com/nocoo/firefly.git
cd firefly
bun install --frozen-lockfile
(cd worker && bun install --frozen-lockfile)
cp .env.example .env
```

编辑根目录 `.env`：

| 配置 | 本地开发所需内容 |
| --- | --- |
| `WORKER_URL`、`WORKER_SECRET` | `http://localhost:8787`、`test-secret`，对应下方本地 Worker 与迁移器 |
| `AUTH_SECRET`、`AUTH_URL` | 自己生成的会话密钥、`http://localhost:7028` |
| `AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_ALLOWED_EMAILS` | Google OAuth 客户端与允许登录的邮箱；回调为 `http://localhost:7028/api/auth/callback/google` |
| `CF_ACCOUNT_ID`、`R2_*` | 上传图片需要自己的 R2 存储桶、S3 凭据与公开访问地址；详见环境模板 |

`CF_API_TOKEN` 与 `CF_D1_DATABASE_ID` 供远程迁移使用，本地 D1 初始化不需要它们。普通开发中的 R2 上传仍访问所配置的远程存储桶；只有测试 runner 使用本地文件适配器。

在仓库根目录启动本地 Worker，保留该终端运行：

```bash
./worker/node_modules/.bin/wrangler dev --local \
  --persist-to "$PWD/.wrangler/state/dev" -c worker/wrangler.toml \
  --port 8787 --var WORKER_SECRET:test-secret
```

另开终端，在仓库根目录初始化本地数据库并启动网页：

```bash
bun run migrate:local
bun run dev
```

打开 `http://localhost:7028`。`migrate:local` 固定连接本地 8787 端口并使用 `test-secret`；这个值仅用于上述本地流程。`bun run migrate` 默认使用生产目标，自行部署前先配置自己的资源。

| 命令 / 路径 | 用途 |
| --- | --- |
| `bun run build`、`bun run start` | 类型检查和网站构建；运行生产网站 |
| `bun run typecheck`、`bun run lint` | 网站与 Worker 的类型、代码检查 |
| `src/app/` | 博客、后台、HTTP API 与 MCP 入口 |
| `src/data/`、`src/services/` | 数据访问与内容操作流程 |
| `worker/src/` | 原生 Fetch Worker、D1 SQL 代理和全文搜索 |
| `scripts/migrations/` | 当前数据库迁移；`archive/` 保留 WordPress 迁移脚本 |

现有部署文档记录网站运行于 Railway。仓库的 GitHub Actions 定义 CI；网站托管、Worker 发布和远程数据库迁移是分别配置的流程，见[开发与部署指南](docs/31-development.md)。

## 测试

先安装根目录与 `worker/` 依赖：

```bash
bun run test
bun run test:worker
bun run test:e2e:api
```

前两个命令运行网站及 Worker 单元测试。API runner 会启动本地 Worker 和 Next.js，应用数据库迁移，并使用本地文件模拟 R2；运行前保持 8787、17028 端口空闲。

```bash
bunx playwright install chromium
bun run test:e2e:bdd
```

浏览器 runner 使用 8787、27028 端口。两类端到端测试共用并重建 `worker/.wrangler/e2e-d1` 和 `.wrangler/e2e-r2`，不要同时运行，也不要与占用 8787 的开发 Worker 同时启动。runner 注入测试会话；真实 Google 登录、外部模型调用与生产备份投递不属于这些测试的验证范围。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| TypeScript、Bun | 应用代码、脚本与依赖管理 |
| Next.js、React | 博客、管理后台与服务端 API |
| Tailwind CSS | 页面样式与主题 |
| Cloudflare Workers、D1 / SQLite FTS5 | 数据访问、中文分词与全文搜索 |
| Cloudflare R2、AWS S3 SDK | 图片存储与上传 |
| Auth.js | Google 登录与管理会话 |
| MCP SDK、Zod | AI 客户端协议与输入校验 |
| Vercel AI SDK、next-ai | 模型配置、摘要与链接文本生成 |
| Vitest、Playwright | 单元、HTTP 和浏览器测试 |

## 文档

- [文档索引](docs/README.md)
- [开发、配置与部署](docs/31-development.md)
- [数据与服务分层](docs/03-architecture.md)
- [MCP 连接协议](docs/11-mcp-server.md)与[实体工具框架](docs/16-mcp-framework.md)
- [媒体库](docs/18-media-library.md)与[图片处理](docs/19-image-optimization.md)
- [人类作者](docs/28-human-authors.md)与[站点公开资料](docs/30-social-preview.md)

## 许可证

[MIT](LICENSE)。
