import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { SITE_URL, ogLocale, htmlLang } from "@/lib/seo";
import { getLocale } from "@/i18n/server";
import { LocaleProvider } from "@/i18n/context";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const [locale, settings] = await Promise.all([
    getLocale(),
    getSiteSettings(db),
  ]);
  const og = ogLocale(locale);
  const lang = htmlLang(locale);
  const fullTitle = settings.siteTagline
    ? `${settings.siteName} – ${settings.siteTagline}`
    : settings.siteName;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: fullTitle,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.siteDescription,
    authors: [{ name: settings.siteAuthor, url: SITE_URL }],
    creator: settings.siteAuthor,
    publisher: settings.siteAuthor,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: SITE_URL,
      languages: { [lang]: SITE_URL },
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
    openGraph: {
      type: "website",
      locale: og,
      url: SITE_URL,
      siteName: settings.siteName,
      title: fullTitle,
      description: settings.siteDescription,
    },
    twitter: {
      card: "summary",
      ...(settings.twitterHandle ? { site: settings.twitterHandle } : {}),
      ...(settings.twitterHandle ? { creator: settings.twitterHandle } : {}),
      title: fullTitle,
      description: settings.siteDescription,
    },
    icons: {
      icon: "/api/favicon",
      apple: "/api/favicon?size=180",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDb();
  const [locale, settings] = await Promise.all([
    getLocale(),
    getSiteSettings(db),
  ]);

  return (
    <html
      lang={htmlLang(locale)}
      data-font-style={settings.fontStyle}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#FAF8F5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1C1A17" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider locale={locale}>
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
