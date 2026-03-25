import { t, type Locale } from "@/i18n/translations";

interface BlogFooterProps {
  locale: Locale;
  siteName: string;
}

export function BlogFooter({ locale, siteName }: BlogFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="blog-footer">
      <span>{t(locale, "blog.footer.copyright", { year, siteName })}</span>
    </footer>
  );
}
