export interface AuthorProfileBriefInput {
  name: string;
  email: string | null;
  hash: string | null;
  profilePublic: boolean;
  siteUrl: string;
  trial?: {
    status: number;
    body: unknown;
  } | null;
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
  const hashLine =
    input.hash ?? "(no email on this human — hash cannot be computed)";
  const emailLine = input.email ?? "(none)";
  const exampleUrl = input.hash
    ? profileLookupUrl(origin, input.hash)
    : `${origin}/api/authors/profile?hash=<sha256 hex>`;

  const trialBlock = input.trial
    ? `\n## Live trial\n\nHTTP ${input.trial.status}\n${JSON.stringify(input.trial.body, null, 2)}\n`
    : "";

  return `# Firefly public author profile lookup

Use this to resolve a human author's public name and avatar without sending their email. Paste into another agent and implement against the contract below. Do not invent a fallback identity when the API returns nulls.

## Endpoint

\`GET ${origin}/api/authors/profile\`

- Unauthenticated.
- Humans only. Never query AI agents.
- Prefer \`hash\` over \`email\` so the address never appears in URLs or logs.

## Query

Provide one of:

- \`hash\` — 64-char lowercase hex SHA-256 of \`email.trim().toLowerCase()\` (UTF-8).
- \`email\` — raw address; the server normalizes with trim + lower-case.

Rules:

- If both are present, only \`hash\` is used.
- A present but invalid \`hash\` (not 64 lowercase hex, including empty) is treated as missing. Do not fall back to email.
- Missing / invalid params return the empty payload. They do not 4xx.

## This human

- Display name (admin only): ${input.name}
- Normalized email (admin only; never returned by the API): ${emailLine}
- SHA-256 hash: ${hashLine}
- \`profile_public\`: ${input.profilePublic ? "1 (lookup can succeed)" : "0 (API returns empty until this is turned on)"}
- Example: \`GET ${exampleUrl}\`

## Response

Always \`200\` except \`429\` when the IP exceeds 30 requests / 60 seconds.

Hit:

\`\`\`json
{ "name": "Display Name", "avatar": "https://cdn.example/humans/{id}/{version}/avatar-80.jpg" }
\`\`\`

Miss / private / bad input:

\`\`\`json
{ "name": null, "avatar": null }
\`\`\`

Never returns email, id, or slug.

## Implementation

1. Compute \`hash = sha256_hex(utf8(email.trim().toLowerCase()))\`.
2. \`GET ${origin}/api/authors/profile?hash={hash}\`.
3. If \`name\` is null, show nothing. Do not substitute site name, logo, or a guessed author.
4. If \`avatar\` is a URL, render it as an image; if null, use a generic person icon.
5. Cache by hash. Do not retry in a loop — the endpoint is rate-limited.
${trialBlock}`.trim();
}
