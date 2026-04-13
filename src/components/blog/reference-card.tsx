import { Link as LinkIcon } from "lucide-react";
import { getDomainBrand, getDisplayDomain } from "@/lib/domain-brand";

interface ReferenceCardProps {
  url: string;
  title?: string | null | undefined;
  description?: string | null | undefined;
  image?: string | null | undefined;
}

/**
 * Bookmark-style card for external reference URLs.
 * Renders as a clickable card with image, title, description, and domain.
 *
 * When image is null, falls through to a branded icon placeholder (GitHub,
 * Twitter, YouTube) or a neutral domain-initial placeholder.
 */
export function ReferenceCard({
  url,
  title,
  description,
  image,
}: ReferenceCardProps) {
  const displayDomain = getDisplayDomain(url);
  const brand = getDomainBrand(displayDomain);

  const placeholder = brand ? (
    <div
      className="reference-card-placeholder"
      style={{ backgroundColor: brand.color }}
    >
      <brand.Icon className="h-8 w-8 text-white" strokeWidth={1.5} aria-hidden="true" />
    </div>
  ) : (
    <div className="reference-card-placeholder reference-card-placeholder-neutral">
      <span className="text-2xl font-bold uppercase text-white/80">
        {displayDomain.charAt(0)}
      </span>
    </div>
  );

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="reference-card"
    >
      <div className="reference-card-image">
        {image ? (
          <img
            src={image}
            alt={title || "Reference"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          placeholder
        )}
      </div>
      <div className="reference-card-content">
        {title && (
          <div className="reference-card-title">{title}</div>
        )}
        {description && (
          <div className="reference-card-description">{description}</div>
        )}
        <div className="reference-card-domain">
          <LinkIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span>{displayDomain}</span>
        </div>
      </div>
    </a>
  );
}
