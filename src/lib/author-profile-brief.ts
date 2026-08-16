export interface AuthorProfileBriefInput {
  name: string;
  email: string | null;
  hash: string | null;
  profilePublic: boolean;
  siteUrl: string;
}

export function profileLookupPath(hash: string): string {
  return `/api/authors/profile?hash=${hash}`;
}

export function profileLookupUrl(siteUrl: string, hash: string): string {
  return `${siteUrl.replace(/\/$/, "")}${profileLookupPath(hash)}`;
}

export function buildAuthorProfileBrief(
  input: AuthorProfileBriefInput,
): string {
  const origin = input.siteUrl.replace(/\/$/, "");
  const exampleUrl = input.hash
    ? profileLookupUrl(origin, input.hash)
    : `${origin}/api/authors/profile?hash=<64-char-hex>`;

  return `公开作者资料查询

把邮箱做成 SHA-256，用 hash 调接口拿公开姓名和头像。

1. 规范化：email.trim().toLowerCase()
2. hash：对 UTF-8 字节做 SHA-256，输出 64 位小写 hex
3. 请求：GET ${exampleUrl}

本作者
- 名称：${input.name}
- 规范化邮箱：${input.email ?? "（未填写，无法计算 hash）"}
- SHA-256：${input.hash ?? "（无）"}
- 公开查询：${input.profilePublic ? "是" : "否（未公开时返回空结果）"}

预期返回

HTTP 200，JSON：

命中：
{ "name": "${input.name}", "avatar": "https://…/avatar-80.jpg" }

未命中 / 未公开 / 缺参或 hash 不合法：
{ "name": null, "avatar": null }

超过 30 次 / 60 秒会 429。
不返回 email、id、slug。`.trim();
}
