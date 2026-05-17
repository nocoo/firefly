"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SocialLink } from "@/data/settings";

const BRAND_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "resume", label: "Resume" },
];

function SocialLinkRow({
  link,
  onChange,
  onRemove,
}: {
  link: SocialLink;
  onChange: (next: SocialLink) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Select
        value={link.brand}
        onChange={(e) => onChange({ ...link, brand: e.target.value })}
        className="w-32 shrink-0"
      >
        {BRAND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Input
        value={link.name}
        onChange={(e) => onChange({ ...link, name: e.target.value })}
        placeholder="名称"
        className="w-28 shrink-0"
      />
      <Input
        value={link.url}
        onChange={(e) => onChange({ ...link, url: e.target.value })}
        placeholder="链接"
        className="flex-1"
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded px-2 py-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
        title="移除"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export function SocialLinksCard({
  socialLinks,
  onChange,
}: {
  socialLinks: SocialLink[];
  onChange: (next: SocialLink[]) => void;
}) {
  const updateAt = (idx: number, next: SocialLink) => {
    const copy = [...socialLinks];
    copy[idx] = next;
    onChange(copy);
  };

  const removeAt = (idx: number) => {
    onChange(socialLinks.filter((_, i) => i !== idx));
  };

  const addLink = () => {
    onChange([...socialLinks, { name: "", url: "", brand: "github" }]);
  };

  return (
    <div className="rounded-card bg-secondary p-5 md:p-6 space-y-4">
      <div>
        <h2 className="text-base font-medium text-foreground">社交链接</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          显示在博客侧边栏的链接。选择平台并输入 URL。
        </p>
      </div>

      <div className="space-y-3">
        {socialLinks.map((link, idx) => (
          <SocialLinkRow
            key={idx}
            link={link}
            onChange={(next) => updateAt(idx, next)}
            onRemove={() => removeAt(idx)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addLink}
        className="text-xs text-primary hover:text-primary/80 transition-colors"
      >
        + 添加链接
      </button>
    </div>
  );
}
