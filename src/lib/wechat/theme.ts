// Scoped CSS styles for WeChat Official Account Markdown rendering.
// Adapted from the Kami / bm.md typography theme:
// - Serif / Chinese Songti typographic elegance
// - Explicit color codes (#141413, #1b365d, #faf9f5, #e5e3d8)
// - Clean blockquote, table, pre/code, lists, and footnote styles
// - Fully inlined via juice for clipboard compatibility with WeChat MP editor.

export const WECHAT_THEME_CSS = `
#bm-md *,
#bm-md *::before,
#bm-md *::after {
  box-sizing: border-box;
}

#bm-md {
  color: #141413;
  background-color: #ffffff;
  font-family: -apple-system-font, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.75;
  text-align: left;
  letter-spacing: 0.034em;
  word-break: break-word;
  padding: 16px 16px 32px;
}

#bm-md h1,
#bm-md h2,
#bm-md h3,
#bm-md h4,
#bm-md h5,
#bm-md h6 {
  font-family: inherit;
  font-weight: 600;
  color: #141413;
  line-height: 1.35;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
}

#bm-md > h1:first-child,
#bm-md > h2:first-child,
#bm-md > h3:first-child,
#bm-md > h4:first-child,
#bm-md > h5:first-child,
#bm-md > h6:first-child {
  margin-top: 0;
}

#bm-md h1 {
  font-size: 24px;
  border-left: 4px solid #1b365d;
  padding-left: 12px;
  margin-top: 2em;
  margin-bottom: 1em;
}

#bm-md h2 {
  font-size: 20px;
  border-left: 3px solid #1b365d;
  padding-left: 10px;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
}

#bm-md h3 {
  font-size: 17px;
  color: #1b365d;
  margin-top: 1.5em;
  margin-bottom: 0.6em;
}

#bm-md h4 {
  font-size: 15px;
  color: #3d3d3a;
}

#bm-md p {
  margin-top: 0;
  margin-bottom: 1.2em;
  color: #2b2b2b;
  line-height: 1.75;
}

#bm-md strong,
#bm-md b {
  color: #141413;
  font-weight: 600;
}

#bm-md em,
#bm-md i {
  color: #2b2b2b;
  font-style: italic;
}

#bm-md del,
#bm-md s {
  color: #8a8880;
  text-decoration: line-through;
}

#bm-md a {
  color: #1b365d;
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-all;
}

#bm-md blockquote {
  margin: 1.2em 0;
  padding: 10px 14px;
  border-left: 3px solid #1b365d;
  background-color: #faf9f5;
  color: #504e49;
  border-radius: 2px;
  line-height: 1.65;
}

#bm-md blockquote p {
  margin-bottom: 0.6em;
  color: #504e49;
}

#bm-md blockquote p:last-child {
  margin-bottom: 0;
}

#bm-md ul,
#bm-md ol {
  margin-top: 0;
  margin-bottom: 1.2em;
  padding-left: 20px;
  color: #2b2b2b;
}

#bm-md li {
  margin-bottom: 0.4em;
  line-height: 1.7;
}

#bm-md code {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 13px;
  background-color: #faf9f5;
  color: #1b365d;
  padding: 2px 5px;
  border-radius: 3px;
  border: 1px solid #e8e6dc;
}

#bm-md pre {
  margin: 1.2em 0;
  padding: 12px 14px;
  background-color: #faf9f5;
  border: 1px solid #e8e6dc;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
}

#bm-md pre code {
  background-color: transparent;
  color: #141413;
  padding: 0;
  border: none;
  border-radius: 0;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
}

#bm-md table {
  width: 100%;
  margin: 1.2em 0;
  border-collapse: collapse;
  font-size: 13px;
  color: #3d3d3a;
  display: table;
}

#bm-md th,
#bm-md td {
  padding: 8px 10px;
  border: 1px solid #e5e3d8;
  text-align: left;
}

#bm-md th {
  background-color: #faf9f5;
  font-weight: 600;
  color: #141413;
}

#bm-md hr {
  margin: 2em 0;
  border: none;
  border-top: 1px solid #e5e3d8;
}

#bm-md img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.2em auto;
  border-radius: 4px;
}

#bm-md .wechat-featured-image {
  margin-bottom: 1.5em;
  overflow: hidden;
  border-radius: 6px;
}

#bm-md .wechat-featured-image img {
  width: 100%;
  margin: 0;
}

#bm-md .wechat-post-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.35;
  color: #141413;
  margin-bottom: 12px;
}

#bm-md .wechat-post-excerpt {
  font-size: 14px;
  color: #6b6a64;
  line-height: 1.6;
  margin-bottom: 16px;
  padding: 10px 14px;
  background-color: #faf9f5;
  border-left: 3px solid #1b365d;
  border-radius: 2px;
}

#bm-md .wechat-reference-card {
  margin: 1.2em 0;
  padding: 12px 14px;
  border: 1px solid #e5e3d8;
  border-radius: 4px;
  background-color: #faf9f5;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

#bm-md .wechat-reference-img {
  width: 80px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
}

#bm-md .wechat-reference-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0;
}

#bm-md .wechat-reference-body {
  flex: 1;
  min-width: 0;
}

#bm-md .wechat-reference-title {
  font-weight: 600;
  font-size: 14px;
  color: #1b365d;
  margin-bottom: 4px;
}

#bm-md .wechat-reference-desc {
  font-size: 12px;
  color: #6b6a64;
  margin-bottom: 4px;
}

#bm-md .wechat-reference-url {
  font-size: 11px;
  color: #8a8880;
  word-break: break-all;
}

#bm-md .wechat-footnotes {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid #e5e3d8;
  font-size: 12px;
  color: #6b6a64;
}

#bm-md .wechat-footnotes h4 {
  font-size: 13px;
  font-weight: 600;
  color: #141413;
  margin-top: 0;
  margin-bottom: 8px;
}

#bm-md .wechat-footnotes ol {
  padding-left: 18px;
  margin-bottom: 0;
}

#bm-md .wechat-footnotes li {
  margin-bottom: 4px;
  line-height: 1.5;
}

#bm-md .wechat-footnote-ref {
  font-size: 10px;
  vertical-align: super;
  color: #1b365d;
  padding: 0 2px;
}
`;
