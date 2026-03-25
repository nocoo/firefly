#!/usr/bin/env bun
/**
 * Release script — automates version bumping, changelog, tagging, and
 * GitHub Release creation.
 *
 * Usage:
 *   bun run release              — Z+1 patch (default)
 *   bun run release -- minor     — Y+1 minor
 *   bun run release -- major     — X+1 major
 *   bun run release -- 2.0.0     — exact version
 *   bun run release -- --dry-run — preview, no mutations
 *
 * Workflow:
 *   1. Determine new version
 *   2. Update package.json
 *   3. Sync lockfile (pnpm install)
 *   4. Prepend CHANGELOG.md entry (from git log)
 *   5. Commit + tag
 *   6. Push + create GitHub Release
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd: string, opts?: { stdio?: "pipe" | "inherit" }): string {
  const result = execSync(cmd, {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: opts?.stdio ?? "pipe",
  });
  // execSync returns null when stdio is "inherit"
  return (result ?? "").trim();
}

function fail(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

function info(msg: string) {
  console.log(`\x1b[36m▸ ${msg}\x1b[0m`);
}

function success(msg: string) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, "..");
const PKG_PATH = resolve(ROOT, "package.json");
const CHANGELOG_PATH = resolve(ROOT, "CHANGELOG.md");

// ---------------------------------------------------------------------------
// Parse arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const versionArg = args.find((a) => a !== "--dry-run");

// ---------------------------------------------------------------------------
// Read current version
// ---------------------------------------------------------------------------

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
const currentVersion: string = pkg.version;
const [major, minor, patch] = currentVersion.split(".").map(Number);

if ([major, minor, patch].some((n) => Number.isNaN(n))) {
  fail(`Invalid current version: ${currentVersion}`);
}

// ---------------------------------------------------------------------------
// Determine new version
// ---------------------------------------------------------------------------

function bumpVersion(): string {
  if (!versionArg || versionArg === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (versionArg === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  if (versionArg === "major") {
    return `${major + 1}.0.0`;
  }
  // Treat as exact version
  if (/^\d+\.\d+\.\d+$/.test(versionArg)) {
    return versionArg;
  }
  fail(`Invalid version argument: ${versionArg}`);
}

const newVersion = bumpVersion();
const tag = `v${newVersion}`;

info(`${currentVersion} → ${newVersion} (tag: ${tag})`);

if (dryRun) {
  info("[dry-run] No changes will be made.");
}

// ---------------------------------------------------------------------------
// Guard: ensure clean working tree
// ---------------------------------------------------------------------------

const gitStatus = run("git status --porcelain");
if (gitStatus && !dryRun) {
  fail("Working tree is dirty. Commit or stash changes first.");
}

// ---------------------------------------------------------------------------
// 1. Update package.json
// ---------------------------------------------------------------------------

info("Updating package.json...");
if (!dryRun) {
  pkg.version = newVersion;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
}
success(`package.json → ${newVersion}`);

// ---------------------------------------------------------------------------
// 2. Sync lockfile
// ---------------------------------------------------------------------------

info("Syncing lockfile (pnpm install)...");
if (!dryRun) {
  run("pnpm install --no-frozen-lockfile", { stdio: "inherit" });
}
success("Lockfile synced");

// ---------------------------------------------------------------------------
// 3. Generate changelog entry
// ---------------------------------------------------------------------------

info("Generating CHANGELOG entry...");

function getChangelog(): string {
  // Find last tag to determine the diff range
  let lastTag: string | null = null;
  try {
    lastTag = run("git describe --tags --abbrev=0 2>/dev/null");
  } catch {
    // No tags yet — use all commits
  }

  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const today = new Date().toISOString().slice(0, 10);

  let commits: string;
  try {
    commits = run(`git log ${range} --oneline --no-decorate`);
  } catch {
    commits = "";
  }

  const lines = commits
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      // Strip leading hash: "abc1234 fix: something" → "fix: something"
      const msg = line.replace(/^[a-f0-9]+ /, "");
      return `- ${msg}`;
    });

  let entry = `## v${newVersion} (${today})\n\n`;
  if (lines.length > 0) {
    entry += lines.join("\n") + "\n";
  } else {
    entry += "- Version bump\n";
  }
  return entry;
}

const changelogEntry = getChangelog();

if (!dryRun) {
  if (existsSync(CHANGELOG_PATH)) {
    const existing = readFileSync(CHANGELOG_PATH, "utf-8");
    // Insert after the "# Changelog" header
    const headerEnd = existing.indexOf("\n");
    if (headerEnd !== -1) {
      const header = existing.slice(0, headerEnd);
      const rest = existing.slice(headerEnd);
      writeFileSync(CHANGELOG_PATH, `${header}\n\n${changelogEntry}${rest}`);
    } else {
      writeFileSync(CHANGELOG_PATH, `# Changelog\n\n${changelogEntry}\n`);
    }
  } else {
    writeFileSync(CHANGELOG_PATH, `# Changelog\n\n${changelogEntry}\n`);
  }
}
success("CHANGELOG.md updated");

if (dryRun) {
  console.log("\n--- CHANGELOG preview ---");
  console.log(changelogEntry);
  console.log("--- end preview ---\n");
}

// ---------------------------------------------------------------------------
// 4. Commit + tag
// ---------------------------------------------------------------------------

info(`Creating commit and tag ${tag}...`);
if (!dryRun) {
  run("git add package.json pnpm-lock.yaml CHANGELOG.md");
  run(`git commit -m "release: ${tag}"`);
  run(`git tag -a ${tag} -m "Release ${tag}"`);
}
success(`Committed and tagged ${tag}`);

// ---------------------------------------------------------------------------
// 5. Push + GitHub Release
// ---------------------------------------------------------------------------

info("Pushing to remote...");
if (!dryRun) {
  run("git push && git push --tags", { stdio: "inherit" });
}
success("Pushed");

info("Creating GitHub Release...");
if (!dryRun) {
  // Use the changelog entry as release notes (strip the header line)
  const notes = changelogEntry
    .split("\n")
    .slice(2) // skip "## v..." and blank line
    .join("\n")
    .trim();

  const escapedNotes = notes.replace(/"/g, '\\"');
  run(
    `gh release create ${tag} --title "${tag}" --notes "${escapedNotes}"`,
    { stdio: "inherit" },
  );
}
success(`GitHub Release ${tag} created`);

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log(
  `\n\x1b[32m🎉 Release ${tag} ${dryRun ? "(dry-run)" : "complete"}!\x1b[0m\n`,
);
