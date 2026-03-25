import { describe, expect, it } from "vitest";
import { getDomainBrand, getDisplayDomain } from "./domain-brand";

describe("getDomainBrand", () => {
  it("returns GitHub brand for github.com", () => {
    const brand = getDomainBrand("github.com");
    expect(brand).toBeDefined();
    expect(brand!.label).toBe("GitHub");
    expect(brand!.color).toBe("#24292f");
  });

  it("returns Twitter brand for x.com", () => {
    const brand = getDomainBrand("x.com");
    expect(brand).toBeDefined();
    expect(brand!.label).toBe("X");
  });

  it("returns Twitter brand for twitter.com", () => {
    const brand = getDomainBrand("twitter.com");
    expect(brand).toBeDefined();
    expect(brand!.label).toBe("Twitter");
  });

  it("returns YouTube brand for youtube.com", () => {
    const brand = getDomainBrand("youtube.com");
    expect(brand).toBeDefined();
    expect(brand!.label).toBe("YouTube");
    expect(brand!.color).toBe("#ff0000");
  });

  it("returns YouTube brand for www.youtube.com", () => {
    const brand = getDomainBrand("www.youtube.com");
    expect(brand).toBeDefined();
    expect(brand!.label).toBe("YouTube");
  });

  it("returns undefined for unknown domain", () => {
    expect(getDomainBrand("unknown.example.com")).toBeUndefined();
  });

  it("strips www. prefix and looks up bare domain", () => {
    const brand = getDomainBrand("www.github.com");
    expect(brand).toBeDefined();
    expect(brand!.label).toBe("GitHub");
  });
});

describe("getDisplayDomain", () => {
  it("extracts hostname from URL", () => {
    expect(getDisplayDomain("https://github.com/foo/bar")).toBe("github.com");
  });

  it("strips www. prefix", () => {
    expect(getDisplayDomain("https://www.example.com/page")).toBe("example.com");
  });

  it("returns input for invalid URL", () => {
    expect(getDisplayDomain("not-a-url")).toBe("not-a-url");
  });

  it("handles URLs with ports", () => {
    expect(getDisplayDomain("https://example.com:8080/path")).toBe("example.com");
  });
});
