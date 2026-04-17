/**
 * URL unfurl service tests.
 *
 * Tests URL validation, SSRF protection, OG metadata extraction,
 * body text extraction, and GitHub README image extraction.
 */

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import {
  validateUrl,
  resolveAndValidateHostname,
  extractOgMetadata,
  extractBodyText,
  fetchHtml,
  fetchGitHubReadmeImage,
  unfurlUrl,
  UnfurlError,
} from "./unfurl";

// ---------------------------------------------------------------------------
// validateUrl — SSRF protection
// ---------------------------------------------------------------------------

describe("validateUrl", () => {
  it("accepts valid https URL", () => {
    const parsed = validateUrl("https://example.com/page");
    expect(parsed.href).toBe("https://example.com/page");
  });

  it("accepts valid http URL", () => {
    const parsed = validateUrl("http://example.com");
    expect(parsed.protocol).toBe("http:");
  });

  it("rejects file: protocol", () => {
    expect(() => validateUrl("file:///etc/passwd")).toThrow(UnfurlError);
    expect(() => validateUrl("file:///etc/passwd")).toThrow("not permitted");
  });

  it("rejects data: protocol", () => {
    expect(() => validateUrl("data:text/html,<h1>hi</h1>")).toThrow(UnfurlError);
  });

  it("rejects ftp: protocol", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow(UnfurlError);
  });

  it("rejects invalid URL format", () => {
    expect(() => validateUrl("not-a-url")).toThrow(UnfurlError);
    expect(() => validateUrl("not-a-url")).toThrow("Invalid URL format");
  });

  it("rejects localhost", () => {
    expect(() => validateUrl("http://localhost:3000")).toThrow("private network");
  });

  it("rejects 127.0.0.1", () => {
    expect(() => validateUrl("http://127.0.0.1")).toThrow("private network");
  });

  it("rejects 10.x.x.x", () => {
    expect(() => validateUrl("http://10.0.0.1")).toThrow("private network");
  });

  it("rejects 172.16.x.x through 172.31.x.x", () => {
    expect(() => validateUrl("http://172.16.0.1")).toThrow("private network");
    expect(() => validateUrl("http://172.31.255.255")).toThrow("private network");
  });

  it("allows 172.15.x.x (not private)", () => {
    const parsed = validateUrl("http://172.15.0.1");
    expect(parsed.hostname).toBe("172.15.0.1");
  });

  it("rejects 192.168.x.x", () => {
    expect(() => validateUrl("http://192.168.1.1")).toThrow("private network");
  });

  it("rejects 169.254.x.x", () => {
    expect(() => validateUrl("http://169.254.0.1")).toThrow("private network");
  });

  it("rejects IPv6 loopback ::1", () => {
    expect(() => validateUrl("http://[::1]")).toThrow("private network");
  });

  it("rejects IPv6 fc00::/7 range", () => {
    expect(() => validateUrl("http://[fc00::1]")).toThrow("private network");
    expect(() => validateUrl("http://[fd12::1]")).toThrow("private network");
  });

  it("returns URL with status 400 for SSRF violations", () => {
    try {
      validateUrl("http://localhost");
    } catch (err) {
      expect(err).toBeInstanceOf(UnfurlError);
      expect((err as UnfurlError).statusCode).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveAndValidateHostname — DNS rebinding protection
// ---------------------------------------------------------------------------

vi.mock("node:dns", () => ({
  default: {
    promises: {
      lookup: vi.fn(),
    },
  },
}));

import dns from "node:dns";
const mockedLookup = vi.mocked(dns.promises.lookup);

describe("resolveAndValidateHostname", () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it("passes for public IP resolution", async () => {
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    await expect(resolveAndValidateHostname("example.com")).resolves.toBeUndefined();
  });

  it("rejects domain resolving to 127.0.0.1", async () => {
    mockedLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects domain resolving to 10.x.x.x", async () => {
    mockedLookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects domain resolving to 192.168.x.x", async () => {
    mockedLookup.mockResolvedValue([{ address: "192.168.1.1", family: 4 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects domain resolving to 172.16.x.x", async () => {
    mockedLookup.mockResolvedValue([{ address: "172.16.0.1", family: 4 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects IPv4-mapped IPv6 resolving to private IP", async () => {
    mockedLookup.mockResolvedValue([{ address: "::ffff:192.168.1.1", family: 6 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects domain resolving to IPv6 loopback", async () => {
    mockedLookup.mockResolvedValue([{ address: "::1", family: 6 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects domain resolving to fc00::/7 range", async () => {
    mockedLookup.mockResolvedValue([{ address: "fd12::1", family: 6 }] as never);
    await expect(resolveAndValidateHostname("evil.com")).rejects.toThrow("resolves to private network");
  });

  it("rejects when any resolved address is private (mixed results)", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ] as never);
    await expect(resolveAndValidateHostname("dual.example.com")).rejects.toThrow("resolves to private network");
  });

  it("passes when all resolved addresses are public", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ] as never);
    await expect(resolveAndValidateHostname("example.com")).resolves.toBeUndefined();
  });

  it("throws on DNS resolution failure", async () => {
    mockedLookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(resolveAndValidateHostname("nonexistent.invalid")).rejects.toThrow("DNS resolution failed");
  });

  it("throws on DNS timeout", async () => {
    // Use fake timers to test the actual timeout path in Promise.race
    vi.useFakeTimers();
    
    // Mock DNS lookup to never resolve (simulates slow/hanging DNS)
    mockedLookup.mockImplementation(() => new Promise(() => {}));
    
    // Start the promise and immediately attach error handler to prevent unhandled rejection
    let caughtError: unknown = null;
    const promise = resolveAndValidateHostname("slow.example.com").catch((err) => {
      caughtError = err;
    });
    
    // Advance past DNS_TIMEOUT_MS (5000ms) to trigger the timeout branch
    await vi.runAllTimersAsync();
    
    // Wait for the catch handler to run
    await promise;
    
    // Restore real timers
    vi.useRealTimers();
    
    // Verify the timeout error was thrown
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain("DNS timeout");
  });

  it("skips DNS for IPv4 literal hostname", async () => {
    await expect(resolveAndValidateHostname("93.184.216.34")).resolves.toBeUndefined();
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("skips DNS for bracketed IPv6 literal hostname", async () => {
    await expect(resolveAndValidateHostname("[2001:db8::1]")).resolves.toBeUndefined();
    expect(mockedLookup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// extractOgMetadata
// ---------------------------------------------------------------------------

describe("extractOgMetadata", () => {
  it("extracts og:title, og:description, og:image", () => {
    const html = `
      <html>
      <head>
        <meta property="og:title" content="Test Title">
        <meta property="og:description" content="Test Description">
        <meta property="og:image" content="https://example.com/image.jpg">
        <title>Page Title</title>
      </head>
      </html>
    `;
    const result = extractOgMetadata(html);
    expect(result.ogTitle).toBe("Test Title");
    expect(result.ogDescription).toBe("Test Description");
    expect(result.ogImage).toBe("https://example.com/image.jpg");
    expect(result.pageTitle).toBe("Page Title");
  });

  it("handles reversed attribute order (content before property)", () => {
    const html = `
      <meta content="Reversed Title" property="og:title">
      <meta content="Reversed Desc" property="og:description">
    `;
    const result = extractOgMetadata(html);
    expect(result.ogTitle).toBe("Reversed Title");
    expect(result.ogDescription).toBe("Reversed Desc");
  });

  it("falls back to meta name description when no og:description", () => {
    const html = `
      <meta name="description" content="Meta description fallback">
    `;
    const result = extractOgMetadata(html);
    expect(result.ogDescription).toBe("Meta description fallback");
  });

  it("falls back to reversed meta name description", () => {
    const html = `
      <meta content="Reversed meta desc" name="description">
    `;
    const result = extractOgMetadata(html);
    expect(result.ogDescription).toBe("Reversed meta desc");
  });

  it("returns null for missing fields", () => {
    const html = "<html><head></head></html>";
    const result = extractOgMetadata(html);
    expect(result.ogTitle).toBeNull();
    expect(result.ogDescription).toBeNull();
    expect(result.ogImage).toBeNull();
    expect(result.pageTitle).toBeNull();
  });

  it("extracts <title> tag", () => {
    const html = "<html><head><title>My Page</title></head></html>";
    const result = extractOgMetadata(html);
    expect(result.pageTitle).toBe("My Page");
  });

  it("decodes HTML entities in OG content", () => {
    const html = `<meta property="og:title" content="Tom &amp; Jerry&#039;s Adventure">`;
    const result = extractOgMetadata(html);
    expect(result.ogTitle).toBe("Tom & Jerry's Adventure");
  });

  it("handles single quotes in meta tags", () => {
    const html = `<meta property='og:title' content='Single Quoted'>`;
    const result = extractOgMetadata(html);
    expect(result.ogTitle).toBe("Single Quoted");
  });

  it("preserves apostrophes in double-quoted content", () => {
    const html = `<meta property="og:title" content="Tom's Repo">`;
    const result = extractOgMetadata(html);
    expect(result.ogTitle).toBe("Tom's Repo");
  });

  it("preserves double quotes in single-quoted content", () => {
    const html = `<meta property='og:description' content='She said "hello" to everyone'>`;
    const result = extractOgMetadata(html);
    expect(result.ogDescription).toBe('She said "hello" to everyone');
  });

  it("preserves apostrophes in double-quoted meta name content", () => {
    const html = `<meta name="description" content="It's a great project">`;
    const result = extractOgMetadata(html);
    expect(result.ogDescription).toBe("It's a great project");
  });
});

// ---------------------------------------------------------------------------
// extractBodyText
// ---------------------------------------------------------------------------

describe("extractBodyText", () => {
  it("strips HTML tags and collapses whitespace", () => {
    const html = "<p>Hello   <strong>world</strong></p><p>foo</p>";
    const result = extractBodyText(html);
    expect(result).toBe("Hello world foo");
  });

  it("removes script and style blocks", () => {
    const html = `
      <script>var x = 1;</script>
      <style>.foo { color: red; }</style>
      <p>Visible text</p>
      <noscript>Noscript content</noscript>
    `;
    const result = extractBodyText(html);
    expect(result).toBe("Visible text");
    expect(result).not.toContain("var x");
    expect(result).not.toContain("color");
    expect(result).not.toContain("Noscript");
  });

  it("truncates to 3000 characters", () => {
    const html = `<p>${"a".repeat(5000)}</p>`;
    const result = extractBodyText(html);
    expect(result.length).toBe(3000);
  });

  it("decodes HTML entities", () => {
    const html = "<p>Tom &amp; Jerry &lt;3&gt;</p>";
    const result = extractBodyText(html);
    expect(result).toBe("Tom & Jerry <3>");
  });

  it("returns empty string for empty HTML", () => {
    const result = extractBodyText("");
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// UnfurlError
// ---------------------------------------------------------------------------

describe("UnfurlError", () => {
  it("has name, message, and statusCode", () => {
    const err = new UnfurlError("test error", 400);
    expect(err.name).toBe("UnfurlError");
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// fetchHtml — tests with mocked global fetch
// ---------------------------------------------------------------------------

describe("fetchHtml", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-establish DNS mock after restoreAllMocks (returns public IP by default)
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: Partial<Response>) {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("<html><title>Test</title></html>"));
          controller.close();
        },
      }),
      ...response,
    } as Response;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);
  }

  it("returns HTML content for successful fetch", async () => {
    mockFetch({});
    const html = await fetchHtml("https://example.com");
    expect(html).toContain("<title>Test</title>");
  });

  it("throws UnfurlError for non-2xx status", async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(fetchHtml("https://example.com")).rejects.toThrow(UnfurlError);
    await expect(fetchHtml("https://example.com")).rejects.toThrow("HTTP 404");
  });

  it("throws UnfurlError for non-HTML content type", async () => {
    mockFetch({
      headers: new Headers({ "content-type": "application/json" }),
    });
    await expect(fetchHtml("https://example.com")).rejects.toThrow("Unsupported content type");
  });

  it("shows 'none' when content-type header is missing entirely", async () => {
    mockFetch({
      headers: new Headers(),
    });
    try {
      await fetchHtml("https://example.com");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UnfurlError);
      expect((err as UnfurlError).message).toContain("none");
    }
  });

  it("re-throws UnfurlError directly from fetch catch", async () => {
    // Simulate validateUrl throwing UnfurlError inside the loop
    // by having fetch throw an UnfurlError (not a generic Error)
    globalThis.fetch = vi.fn().mockRejectedValue(new UnfurlError("SSRF blocked", 400));
    try {
      await fetchHtml("https://example.com");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UnfurlError);
      expect((err as UnfurlError).message).toBe("SSRF blocked");
      expect((err as UnfurlError).statusCode).toBe(400);
    }
  });

  it("wraps non-Error throw in fetch catch", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue("string error");
    try {
      await fetchHtml("https://example.com");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UnfurlError);
      expect((err as UnfurlError).message).toContain("Unknown fetch error");
    }
  });

  it("follows redirects and validates each hop", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 302,
          headers: new Headers({ location: "https://example.com/final" }),
          body: null,
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("<html>Redirected</html>"));
            controller.close();
          },
        }),
      } as unknown as Response);
    });

    const html = await fetchHtml("https://example.com");
    expect(html).toContain("Redirected");
    expect(callCount).toBe(2);
  });

  it("rejects redirects to private network", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 301,
      headers: new Headers({ location: "http://127.0.0.1/admin" }),
      body: null,
    } as unknown as Response);

    await expect(fetchHtml("https://example.com")).rejects.toThrow("private network");
  });

  it("throws on redirect without Location header", async () => {
    mockFetch({
      ok: false,
      status: 302,
      headers: new Headers(),
    });
    await expect(fetchHtml("https://example.com")).rejects.toThrow("Redirect without Location");
  });

  it("rejects SSRF on initial URL", async () => {
    await expect(fetchHtml("http://localhost")).rejects.toThrow("private network");
  });

  it("throws UnfurlError when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    await expect(fetchHtml("https://example.com")).rejects.toThrow("Failed to fetch URL");
  });

  it("truncates response body exceeding 2MB", async () => {
    // Create a response body larger than 2MB
    const chunk = new Uint8Array(1024 * 1024); // 1MB of zeros
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: new ReadableStream({
        start(controller) {
          // Push 3 chunks of 1MB each (total 3MB > 2MB limit)
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      }),
    } as unknown as Response);

    // Should not throw — it truncates at 2MB
    const html = await fetchHtml("https://example.com");
    expect(typeof html).toBe("string");
  });

  it("throws on too many redirects", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ location: "https://example.com/loop" }),
      body: null,
    } as unknown as Response);

    await expect(fetchHtml("https://example.com")).rejects.toThrow("Too many redirects");
  });

  it("handles empty response body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: null,
    } as unknown as Response);

    await expect(fetchHtml("https://example.com")).rejects.toThrow("No response body");
  });
});

// ---------------------------------------------------------------------------
// fetchGitHubReadmeImage
// ---------------------------------------------------------------------------

describe("fetchGitHubReadmeImage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null for non-GitHub URLs", async () => {
    const result = await fetchGitHubReadmeImage("https://example.com");
    expect(result).toBeNull();
  });

  it("returns null for GitHub gist URLs", async () => {
    const result = await fetchGitHubReadmeImage("https://github.com/gist/123");
    expect(result).toBeNull();
  });

  it("extracts first image from README.md", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# Project\n\n![Screenshot](./docs/screenshot.png)\n\nSome text"),
    } as unknown as Response);

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo");
    expect(result).toBe("https://raw.githubusercontent.com/owner/repo/main/docs/screenshot.png");
  });

  it("returns absolute image URL as-is", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("![](https://cdn.example.com/banner.png)"),
    } as unknown as Response);

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo");
    expect(result).toBe("https://cdn.example.com/banner.png");
  });

  it("tries master branch when main branch 404s", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve("![](./img.png)"),
      } as unknown as Response);
    });

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo");
    expect(result).toBe("https://raw.githubusercontent.com/owner/repo/master/img.png");
    expect(callCount).toBe(2);
  });

  it("returns null when README has no images", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# Project\n\nNo images here."),
    } as unknown as Response);

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo");
    expect(result).toBeNull();
  });

  it("returns null when both branches fail", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo");
    expect(result).toBeNull();
  });

  it("strips .git suffix from repo name", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("![](./img.png)"),
    } as unknown as Response);

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo.git");
    expect(result).toBe("https://raw.githubusercontent.com/owner/repo/main/img.png");
  });

  it("returns null when fetch throws an error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchGitHubReadmeImage("https://github.com/owner/repo");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// unfurlUrl — integration with mocked fetch
// ---------------------------------------------------------------------------

describe("unfurlUrl", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns structured result for valid HTML page", async () => {
    const html = `
      <html>
      <head>
        <meta property="og:title" content="Example Site">
        <meta property="og:description" content="An example.">
        <meta property="og:image" content="https://example.com/og.jpg">
        <title>Example</title>
      </head>
      <body><p>Page body content.</p></body>
      </html>
    `;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(html));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await unfurlUrl("https://example.com");
    expect(result.url).toBe("https://example.com");
    expect(result.ogTitle).toBe("Example Site");
    expect(result.ogDescription).toBe("An example.");
    expect(result.ogImage).toBe("https://example.com/og.jpg");
    expect(result.pageTitle).toBe("Example");
    expect(result.bodyText).toContain("Page body content");
    expect(result.readmeImage).toBeNull(); // Not GitHub, no README fetch
  });

  it("throws for SSRF-blocked URLs", async () => {
    await expect(unfurlUrl("http://localhost")).rejects.toThrow(UnfurlError);
    await expect(unfurlUrl("file:///etc/passwd")).rejects.toThrow(UnfurlError);
  });

  it("skips GitHub README image when ogImage is present", async () => {
    const html = `<meta property="og:image" content="https://example.com/og.jpg">`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(html));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await unfurlUrl("https://github.com/owner/repo");
    expect(result.ogImage).toBe("https://example.com/og.jpg");
    // Should not have tried to fetch README since ogImage exists
    expect(result.readmeImage).toBeNull();
  });

  it("fetches GitHub README image when no ogImage for GitHub URL", async () => {
    const html = `<html><head><title>My Repo</title></head><body>Repo page</body></html>`;
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      // First call: fetchHtml for the GitHub page
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(html));
              controller.close();
            },
          }),
        } as unknown as Response);
      }
      // Second call: fetchGitHubReadmeImage (README.md from main branch)
      if (url.includes("/main/README.md")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("# Repo\n\n![Screenshot](./docs/screen.png)"),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const result = await unfurlUrl("https://github.com/owner/repo");
    expect(result.ogImage).toBeNull();
    expect(result.readmeImage).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/docs/screen.png",
    );
  });

  it("resolves relative og:image to absolute URL", async () => {
    const html = `<meta property="og:image" content="/images/og.jpg">`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(html));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await unfurlUrl("https://example.com/page");
    expect(result.ogImage).toBe("https://example.com/images/og.jpg");
  });

  it("resolves protocol-relative og:image", async () => {
    const html = `<meta property="og:image" content="//cdn.example.com/img.jpg">`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(html));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await unfurlUrl("https://example.com");
    expect(result.ogImage).toBe("https://cdn.example.com/img.jpg");
  });

  it("keeps absolute og:image unchanged", async () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/og.jpg">`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(html));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await unfurlUrl("https://example.com");
    expect(result.ogImage).toBe("https://cdn.example.com/og.jpg");
  });
});
