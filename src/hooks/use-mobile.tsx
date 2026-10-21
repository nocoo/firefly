"use client";

import { useSyncExternalStore } from "react";

// Mobile breakpoint: < 768px (48em)
const MOBILE_BREAKPOINT = 48;
// Tablet breakpoint: < 1024px (64em)
const TABLET_BREAKPOINT = 64;

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const getServerSnapshot = () => false;
const getMobileSnapshot = () => window.innerWidth / 16 < MOBILE_BREAKPOINT;
const getTabletSnapshot = () => window.innerWidth / 16 < TABLET_BREAKPOINT;

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getMobileSnapshot, getServerSnapshot);
}

export function useIsTablet() {
  return useSyncExternalStore(subscribe, getTabletSnapshot, getServerSnapshot);
}
