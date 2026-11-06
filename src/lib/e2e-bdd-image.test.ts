import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { e2eBddTestImageUrl } from "./e2e-bdd-image";

describe("e2eBddTestImageUrl", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.R2_PUBLIC_URL;
    Reflect.deleteProperty(process.env, "R2_PUBLIC_URL");
  });

  afterEach(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, "R2_PUBLIC_URL");
    else process.env.R2_PUBLIC_URL = saved;
  });

  it("uses assets.example.com when R2_PUBLIC_URL is unset", () => {
    expect(
      e2eBddTestImageUrl(undefined),
    ).toBe("https://assets.example.com/wp-content/uploads/test-e2e.jpg");
  });

  it("prefixes __e2e-r2 URL with the R2 path segment", () => {
    expect(
      e2eBddTestImageUrl("http://localhost:27028/__e2e-r2"),
    ).toBe(
      "http://localhost:27028/__e2e-r2/wp-content/uploads/test-e2e.jpg",
    );
  });

  it("strips trailing slash before appending key", () => {
    expect(
      e2eBddTestImageUrl("http://localhost:27028/__e2e-r2/"),
    ).toBe(
      "http://localhost:27028/__e2e-r2/wp-content/uploads/test-e2e.jpg",
    );
  });

  it("uses origin-only path for non-e2e asset hosts", () => {
    expect(
      e2eBddTestImageUrl("https://cdn.example.com/bucket"),
    ).toBe("https://cdn.example.com/wp-content/uploads/test-e2e.jpg");
  });
});
