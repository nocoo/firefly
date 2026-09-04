/**
 * Extract clean plain text from HTML, preserving paragraphs, list items,
 * and line breaks rather than concatenating text nodes together.
 */
export function extractPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Traverse DOM and convert block elements to formatted text with newlines
  const blocks = new Set([
    "P",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "BLOCKQUOTE",
    "PRE",
    "SECTION",
    "TR",
  ]);

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === "BR") {
      return "\n";
    }

    let text = "";
    for (let i = 0; i < el.childNodes.length; i++) {
      text += walk(el.childNodes[i]);
    }

    if (blocks.has(tag)) {
      if (tag === "LI") {
        return `• ${text.trim()}\n`;
      }
      return `${text.trim()}\n\n`;
    }

    return text;
  }

  return walk(temp).replace(/\n{3,}/g, "\n\n").trim();
}

export function copyViaExecCommand(html: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = html;
  document.body.appendChild(container);

  const selection = window.getSelection();
  const originalRanges: Range[] = [];
  if (selection) {
    for (let i = 0; i < selection.rangeCount; i++) {
      originalRanges.push(selection.getRangeAt(i));
    }
  }

  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return document.execCommand("copy");
  } catch (err) {
    console.error("execCommand copy error:", err);
    return false;
  } finally {
    if (selection) {
      selection.removeAllRanges();
      for (const r of originalRanges) {
        selection.addRange(r);
      }
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Remove images, pictures and figures from HTML for clean text-only copying.
 */
export function stripImagesFromHtml(html: string): string {
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const images = temp.querySelectorAll("img, picture, figure");
    for (const el of Array.from(images)) {
      el.remove();
    }
    return temp.innerHTML;
  }
  return html
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "")
    .replace(/<img\b[^>]*\/?>/gi, "");
}

/**
 * Copy rich HTML content (with fallback plain text) to clipboard.
 */
export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  const plainText = extractPlainText(html);

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      const item = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.write failed, falling back to execCommand:", err);
    }
  }

  return copyViaExecCommand(html);
}

export async function copyWechatHtmlToClipboard(html: string): Promise<boolean> {
  const plainText = extractPlainText(html);

  // Attempt modern navigator.clipboard.write with ClipboardItem
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      const item = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.write failed, falling back to execCommand:", err);
    }
  }

  // Fallback to execCommand
  return copyViaExecCommand(html);
}
