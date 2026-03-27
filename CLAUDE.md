# Firefly

Personal blog platform built with Next.js + Cloudflare Workers.

## Retrospective

### 2026-03-27: tsconfig.tsbuildinfo 导致 release 脚本失败
**问题**: `bun run release` 报 "Working tree is dirty"，原因是 `tsconfig.tsbuildinfo` 被 git 跟踪但每次 build 都会变更。
**修复**: 将 `*.tsbuildinfo` 加入 `.gitignore` 并 `git rm --cached` 移除跟踪。
**教训**: 构建产物不应被 git 跟踪，新项目初始化时应确保 `.gitignore` 覆盖所有构建缓存文件。
