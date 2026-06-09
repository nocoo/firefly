"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createPortal } from "react-dom";

/**
 * Client enhancer for `<pre.blog-code-block>` produced by renderMarkdown.
 *
 * Mounts beside `<ArticleBody>` (zero render in normal flow) and uses DOM
 * delegation to attach a copy button + language label to every code block in
 * the visible article. Re-runs when the article content changes (next/router
 * navigation between posts).
 *
 * The actions are rendered as React portals into each `<pre>` (positioned
 * absolute) so they live in document order with the code they belong to —
 * better for keyboard / screen reader, and copy can read the textContent of
 * the matching `<code>` directly without DOM lookups.
 */
export function CodeBlockActions() {
  const [blocks, setBlocks] = useState<HTMLPreElement[]>([]);

  useEffect(() => {
    const root = document.querySelector(".blog-content");
    if (!root) return;
    const found = Array.from(
      root.querySelectorAll<HTMLPreElement>("pre.blog-code-block"),
    );
    // Each pre needs `position: relative` so the absolute portal anchor
    // positions against it. Done in JS so the static markdown stays clean.
    for (const el of found) {
      if (getComputedStyle(el).position === "static") {
        el.style.position = "relative";
      }
    }
    setBlocks(found);
  }, []);

  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((el, i) => (
        <CodeBlockOverlay key={i} pre={el} />
      ))}
    </>
  );
}

function CodeBlockOverlay({ pre }: { pre: HTMLPreElement }) {
  const lang = pre.dataset.lang ?? null;
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const code = pre.querySelector("code");
    const text = code?.textContent ?? pre.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / insecure contexts: silently swallow — toast in this
      // path would require dragging in sonner; not worth it for a fallback.
    }
  };

  return createPortal(
    <div className="blog-code-actions" aria-hidden={false}>
      {lang && <span className="blog-code-lang">{lang}</span>}
      <button
        type="button"
        onClick={onCopy}
        className="blog-code-copy"
        aria-label={copied ? "已复制" : "复制代码"}
        title={copied ? "已复制" : "复制代码"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    </div>,
    pre,
  );
}
