"use client";

import { useRef, useState, useCallback, useEffect, type ComponentProps } from "react";
import { ResponsiveContainer as RechartsResponsiveContainer } from "recharts";

const CHART_RESIZE_DEBOUNCE_MS = 180;

type DashboardResponsiveContainerProps = ComponentProps<
  typeof RechartsResponsiveContainer
>;

/**
 * Wrapper around Recharts ResponsiveContainer that defers rendering
 * until the container has a positive measured size.
 *
 * Recharts logs noisy warnings when width/height resolve to ≤0
 * (e.g. during initial layout before the browser has painted).
 * We observe the wrapper div via ResizeObserver and only mount the
 * actual ResponsiveContainer once both dimensions are positive.
 */
export function DashboardResponsiveContainer({
  debounce = CHART_RESIZE_DEBOUNCE_MS,
  minWidth = 0,
  minHeight = 0,
  ...props
}: DashboardResponsiveContainerProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // Ref callback: check size on initial mount without triggering
  // the "setState in effect body" lint rule.
  const refCallback = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
    if (!node) return;
    const { width, height } = node.getBoundingClientRect();
    if (width > 0 && height > 0) setReady(true);
  }, []);

  // Fallback: ResizeObserver for cases where the element is not yet laid out
  // at ref-callback time (e.g. CSS transitions, lazy containers).
  useEffect(() => {
    if (ready) return;
    const el = elRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setReady(true);
          observer.disconnect();
          return;
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div ref={refCallback} style={{ width: "100%", height: "100%" }}>
      {ready && (
        <RechartsResponsiveContainer
          debounce={debounce}
          minWidth={minWidth}
          minHeight={minHeight}
          {...props}
        />
      )}
    </div>
  );
}
