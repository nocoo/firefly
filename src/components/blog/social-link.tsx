import type { LucideIcon } from "lucide-react";

interface SocialLinkProps {
  href: string;
  name: string;
  brand: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  isLucide: boolean;
}

export function SocialLink({ href, name, brand, icon: Icon, isLucide }: SocialLinkProps) {
  const label = name || brand;

  return (
    <a
      href={href}
      title={label}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      aria-label={label}
      className="blog-social-link"
      data-brand={brand}
    >
      {isLucide ? (
        <Icon className="blog-social-icon" strokeWidth={1.5} />
      ) : (
        <Icon className="blog-social-icon" />
      )}
    </a>
  );
}
