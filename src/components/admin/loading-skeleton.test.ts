import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio/slim";
import { describe, expect, it } from "vitest";

const adminRoot = resolve("src/app/admin");
const pages = readdirSync(adminRoot, { recursive: true })
  .filter((name) => typeof name === "string" && /(^|\/)page\.tsx$/.test(name)) as string[];

describe("admin route loading boundaries", () => {
  it("covers every admin page with a native loading boundary", () => {
    expect(pages).toHaveLength(17);
    for (const page of pages) {
      expect(existsSync(resolve(adminRoot, page.replace(/page\.tsx$/, "loading.tsx"))), page).toBe(true);
    }
  });

  it.each(pages)("%s renders accessible, noninteractive placeholders", async (page) => {
    const { default: Loading } = await import(resolve(adminRoot, page.replace(/page\.tsx$/, "loading.tsx")));
    const html = renderToStaticMarkup(createElement(Loading));
    const $ = load(html);
    expect($('[role="status"][aria-busy="true"]')).toHaveLength(1);
    expect($('[role="status"]').attr("aria-label")).toMatch(/加载/);
    expect($('[data-admin-page-header] h1').text().trim()).not.toBe("");
    expect($('[data-admin-page-header] p').text().trim()).not.toBe("");
    expect($('[data-admin-page-header] a').text()).toBe("");
    expect($('[data-admin-page-header] a').attr("aria-label")).toMatch(/^返回/);
    expect($("input, textarea, select, button")).toHaveLength(0);
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain('aria-hidden="true"');
  });
});
