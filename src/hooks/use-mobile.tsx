"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

function subscribeMobile(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
}

function subscribeTablet(callback: () => void) {
  const mql = window.matchMedia(
    `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
  );
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getTabletSnapshot(): boolean {
  return window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT;
}

function getTabletServerSnapshot(): boolean {
  return false;
}

export function useIsTablet() {
  return useSyncExternalStore(subscribeTablet, getTabletSnapshot, getTabletServerSnapshot);
}
