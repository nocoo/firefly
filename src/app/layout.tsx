import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SITE_AUTHOR, TWITTER_HANDLE } from "@/lib/seo";
import { getLocale } from "@/i18n/server";
import { LocaleProvider } from "@/i18n/context";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – 知白守黑，不语万千算`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  authors: [{ name: SITE_AUTHOR, url: SITE_URL }],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
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
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – 知白守黑，不语万千算`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: `${SITE_NAME} – 知白守黑，不语万千算`,
    description: SITE_DESCRIPTION,
  },
};

// Inline script to prevent dark mode FOUC — runs before paint
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  } catch(e){}
})();
`;

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
      lang={locale === "zh" ? "zh-CN" : "en"}
      data-font-style={settings.fontStyle}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <meta name="theme-color" content="#FAF8F5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1C1A17" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="antialiased">
        <LocaleProvider locale={locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
