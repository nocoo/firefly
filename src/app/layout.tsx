import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Serif } from "next/font/google";
import { SITE_URL, OG_LOCALE, HTML_LANG } from "@/lib/seo";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

/**
 * Revalidate every 5 minutes so metadata changes (site name, description,
 * tagline) propagate without a full redeploy. Without this, Next.js sets
 * s-maxage=31536000 and CDN caches the pre-rendered HTML indefinitely.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const settings = await getSiteSettings(db);
  const fullTitle = settings.siteTagline
    ? `${settings.siteName} – ${settings.siteTagline}`
    : settings.siteName;

  // Prefer siteDescription; fall back to siteTagline; omit if both empty
  // so Next.js does not render an empty <meta name="description"> tag.
  const description =
    settings.siteDescription || settings.siteTagline || undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: fullTitle,
      template: `%s | ${settings.siteName}`,
    },
    description,
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
      languages: { [HTML_LANG]: SITE_URL },
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
    openGraph: {
      type: "website",
      locale: OG_LOCALE,
      url: SITE_URL,
      siteName: settings.siteName,
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary",
      ...(settings.twitterHandle ? { site: settings.twitterHandle } : {}),
      ...(settings.twitterHandle ? { creator: settings.twitterHandle } : {}),
      title: fullTitle,
      description,
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
  const settings = await getSiteSettings(db);

  return (
    <html
      lang={HTML_LANG}
      data-font-style={settings.fontStyle}
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${ibmPlexSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#f5f4f3" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#13151a" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
