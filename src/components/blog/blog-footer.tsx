import { t, type Locale } from "@/i18n/translations";

interface BlogFooterProps {
  locale: Locale;
}

export function BlogFooter({ locale }: BlogFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="blog-footer">
      <span>{t(locale, "blog.footer.copyright", { year })}</span>
    </footer>
  );
}
