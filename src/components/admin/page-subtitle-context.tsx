"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface PageSubtitleContextValue {
  subtitle: string | null;
  setSubtitle: (value: string | null) => void;
}

const PageSubtitleContext = createContext<PageSubtitleContextValue>({
  subtitle: null,
  setSubtitle: () => { /* default no-op until provider mounts */ },
});

export function PageSubtitleProvider({ children }: { children: React.ReactNode }) {
  const [subtitle, setSubtitle] = useState<string | null>(null);
  return (
    <PageSubtitleContext.Provider value={{ subtitle, setSubtitle }}>
      {children}
    </PageSubtitleContext.Provider>
  );
}

export function usePageSubtitle() {
  return useContext(PageSubtitleContext);
}

/**
 * Hook to set page subtitle on mount and clear it on unmount.
 * Call from any admin page component to display subtitle in the shell header.
 */
export function useSetPageSubtitle(value: string | null) {
  const { setSubtitle } = usePageSubtitle();
  useEffect(() => {
    setSubtitle(value);
    return () => setSubtitle(null);
  }, [value, setSubtitle]);
}
