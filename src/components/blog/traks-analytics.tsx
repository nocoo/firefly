/** Self-hosted Traks analytics for the public blog shell only. */
export function TraksAnalytics() {
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
