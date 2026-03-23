"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";

interface SocialLinkProps {
  href: string;
  name: string;
  brand: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  isLucide: boolean;
}

export function SocialLink({ href, name, brand, icon: Icon, isLucide }: SocialLinkProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={href}
      title={name}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      className="blog-social-link"
      data-brand={brand}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isLucide ? (
        <Icon className="blog-social-icon" strokeWidth={1.5} fill={isHovered ? "currentColor" : "none"} />
      ) : (
        <Icon className="blog-social-icon" />
      )}
    </a>
  );
}
