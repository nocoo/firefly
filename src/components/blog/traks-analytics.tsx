/** Self-hosted Traks analytics for the public blog shell only. */
export function TraksAnalytics() {
  // L3 Playwright uses `waitUntil: "networkidle"`. The collector's script keeps
  // long-lived or recurring network activity in some CI networks, so `networkidle`
  // never fires within the test timeout. Runner sets `E2E_TEST_RUNNER`; production
  // and manual QA still load the real script.
  if (process.env.E2E_TEST_RUNNER === "true") {
    return null;
  }
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "window.traks=window.traks||function(){(window.traks.q=window.traks.q||[]).push(arguments)}",
        }}
      />
      <script
        defer
        data-site="pb_live_sybuasmjnudj7h2ajwpbf520"
        src="https://track-collect.nocoo.cloud/t.js"
      />
    </>
  );
}
