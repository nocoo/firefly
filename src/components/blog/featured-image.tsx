import Image from "next/image";

/**
 * Standard `sizes` value for blog featured images. Matches the post-card and
 * detail-page layouts (max content column ~1000px on desktop, full-width below
 * 900px). Keep all featured-image call sites pointed at this constant so the
 * `srcset` cannot drift across pages.
 */
export const FEATURED_IMAGE_SIZES =
  "(max-width: 900px) 100vw, min(75vw, 1000px)";

interface FeaturedImageProps {
  src: string;
  alt: string;
  /** Set true for the page's hero image — sets `priority` + `fetchPriority="high"`. */
  priority?: boolean;
  className?: string;
}

/**
 * Aspect-ratio framed featured image for blog post cards and detail pages.
 *
 * Uses Next.js `<Image fill>` with the canonical `sizes` so all call sites stay
 * in lockstep. Caller is responsible for adding a `<Link>` overlay if the image
 * should be clickable.
 */
export function FeaturedImage({
  src,
  alt,
  priority = false,
  className,
}: FeaturedImageProps) {
  return (
    <div className={`blog-featured-image${className ? ` ${className}` : ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={FEATURED_IMAGE_SIZES}
        priority={priority}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </div>
  );
}
