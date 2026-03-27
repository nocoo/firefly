"use client";

// ---------------------------------------------------------------------------
// ContentImageLightbox — zero-prop client component
//
// Mounts beside <ArticleBody> in blog pages. Attaches a click listener to
// `.blog-content img` via DOM event delegation — no HTML string crosses the
// RSC client boundary. Images wrapped in links (<a><img></a>) are skipped.
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface LightboxState {
  src: string;
  alt: string;
}

export function ContentImageLightbox() {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  useEffect(() => {
    const container = document.querySelector(".blog-content");
    if (!container) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG") return;

      // If the image is wrapped in a link, let the link navigate normally
      if (target.closest("a")) return;

      e.preventDefault();
      const img = target as HTMLImageElement;
      setLightbox({
        src: img.dataset.originalSrc ?? img.src,
        alt: img.alt || "",
      });
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  if (!lightbox) return null;

  return (
    <ImageLightbox
      src={lightbox.src}
      alt={lightbox.alt}
      open
      onClose={() => setLightbox(null)}
    />
  );
}
