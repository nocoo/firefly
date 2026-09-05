import { FileUser, Globe, Mail } from "lucide-react";
import { Facebook, Github, Linkedin } from "@/components/icons/brand";
import type { SocialLink as SocialLinkData } from "@/data/settings";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const BRAND_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  x: XIcon, facebook: Facebook, linkedin: Linkedin, email: Mail, github: Github, resume: FileUser,
};

function SocialLink({ name, url, brand }: SocialLinkData) {
  const label = name || brand;
  const Icon = BRAND_ICONS[brand] ?? Globe;
  const href = brand === "email" && !url.startsWith("mailto:") ? `mailto:${url}` : url;
  const isEmail = href.startsWith("mailto:");

  return (
    <a
      href={href}
      target={isEmail ? undefined : "_blank"}
      rel={isEmail ? undefined : "noopener noreferrer"}
      className="blog-social-link"
      data-brand={brand}
      title={label}
    >
      <span className="journal-social-symbol" aria-hidden="true">
        <Icon className="blog-social-icon" strokeWidth={1.5} />
      </span>
      <span className="sr-only">{label}</span>
    </a>
  );
}

export function JournalSocialLinks({ links }: { links: SocialLinkData[] }) {
  if (links.length === 0) return null;
  return (
    <nav className="journal-connect" aria-label="社交网络">
      <ul className="journal-social-list">
        {links.map((link) => <li key={link.url}><SocialLink {...link} /></li>)}
      </ul>
    </nav>
  );
}
