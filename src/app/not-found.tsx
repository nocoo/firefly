import Link from "next/link";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

export default async function NotFound() {
  const locale = await getLocale();

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-blog-muted">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-blog-text">
        {t(locale, "blog.notFound")}
      </h2>
      <p className="mt-2 text-blog-muted">
        {t(locale, "blog.notFound.description")}
      </p>
      <Link
        href="/"
        className="mt-6 text-sm text-blog-muted transition-colors hover:text-blog-text"
      >
        {t(locale, "blog.notFound.backHome")}
      </Link>
    </main>
  );
}
