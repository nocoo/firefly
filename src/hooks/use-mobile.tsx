"use client";

import { useEffect, useState } from "react";

// Mobile breakpoint: < 768px (48em)
const MOBILE_BREAKPOINT = 48;
// Tablet breakpoint: < 1024px (64em)
const TABLET_BREAKPOINT = 64;

function getBreakpoint() {
  if (typeof window === "undefined") return { isMobile: false, isTablet: false };
  const em = window.innerWidth / 16;
  return {
    isMobile: em < MOBILE_BREAKPOINT,
    isTablet: em < TABLET_BREAKPOINT,
  };
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getBreakpoint().isMobile);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(getBreakpoint().isMobile);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(getBreakpoint().isTablet);

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(getBreakpoint().isTablet);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isTablet;
}
