import { describe, it, expect } from "vitest";
import { detectBot, parseDevice } from "./analytics";

// ---------------------------------------------------------------------------
// detectBot
// ---------------------------------------------------------------------------

describe("detectBot", () => {
  it("detects Googlebot as search bot", () => {
    const result = detectBot(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    );
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("Googlebot");
    expect(result.botCategory).toBe("search");
  });

  it("detects Bingbot as search bot", () => {
    const result = detectBot(
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    );
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("Bingbot");
    expect(result.botCategory).toBe("search");
  });

  it("detects GPTBot as AI bot", () => {
    const result = detectBot("Mozilla/5.0 GPTBot/1.0");
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("GPTBot");
    expect(result.botCategory).toBe("ai");
  });

  it("detects ClaudeBot as AI bot", () => {
    const result = detectBot("ClaudeBot/1.0");
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("ClaudeBot");
    expect(result.botCategory).toBe("ai");
  });

  it("detects CCBot as AI bot", () => {
    const result = detectBot(
      "CCBot/2.0 (https://commoncrawl.org/faq/)",
    );
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("CCBot");
    expect(result.botCategory).toBe("ai");
  });

  it("detects Facebook as social bot", () => {
    const result = detectBot(
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    );
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("Facebook");
    expect(result.botCategory).toBe("social");
  });

  it("detects Twitterbot as social bot", () => {
    const result = detectBot("Twitterbot/1.0");
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("Twitterbot");
    expect(result.botCategory).toBe("social");
  });

  it("detects UptimeRobot as monitoring bot", () => {
    const result = detectBot("UptimeRobot/2.0");
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe("UptimeRobot");
    expect(result.botCategory).toBe("monitor");
  });

  it("detects generic bot pattern", () => {
    const result = detectBot("SomeRandomBot/1.0");
    expect(result.isBot).toBe(true);
    expect(result.botCategory).toBe("other");
  });

  it("returns false for normal browser UA", () => {
    const result = detectBot(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    expect(result.isBot).toBe(false);
    expect(result.botName).toBeNull();
    expect(result.botCategory).toBeNull();
  });

  it("returns false for null UA", () => {
    const result = detectBot(null);
    expect(result.isBot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseDevice
// ---------------------------------------------------------------------------

describe("parseDevice", () => {
  it("detects desktop Chrome on macOS", () => {
    const result = parseDevice(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("macOS");
  });

  it("detects mobile Safari on iOS", () => {
    const result = parseDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    expect(result.deviceType).toBe("mobile");
    expect(result.browser).toBe("Safari");
    expect(result.os).toBe("iOS");
  });

  it("detects tablet iPad", () => {
    const result = parseDevice(
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    expect(result.deviceType).toBe("tablet");
  });

  it("detects mobile Android Chrome", () => {
    const result = parseDevice(
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36",
    );
    expect(result.deviceType).toBe("mobile");
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("Android");
  });

  it("detects Firefox on Windows", () => {
    const result = parseDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    );
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toBe("Firefox");
    expect(result.os).toBe("Windows");
  });

  it("detects Edge browser", () => {
    const result = parseDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    );
    expect(result.browser).toBe("Edge");
  });

  it("classifies bots as device type bot", () => {
    const result = parseDevice(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    );
    expect(result.deviceType).toBe("bot");
    expect(result.browser).toBeNull();
    expect(result.os).toBeNull();
  });

  it("returns desktop for null UA", () => {
    const result = parseDevice(null);
    expect(result.deviceType).toBe("desktop");
  });

  it("detects Linux desktop", () => {
    const result = parseDevice(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    );
    expect(result.deviceType).toBe("desktop");
    expect(result.os).toBe("Linux");
  });
});
