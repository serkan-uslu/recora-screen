import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { product } from "@/shared/brand";
import { Analytics } from "@/website/components/Analytics";
import { SiteFooter } from "@/website/components/SiteFooter";
import { SiteHeader } from "@/website/components/SiteHeader";
import { assetPath, site } from "@/website/lib/site";
import "@/website/src/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.SITE_URL),
  title: { default: `${product.name} — Record once. Edit less.`, template: `%s — ${product.name}` },
  description: product.description,
  applicationName: product.name,
  category: "technology",
  icons: { icon: assetPath("icon.svg") },
  alternates: { canonical: site.SITE_URL },
  openGraph: {
    type: "website",
    siteName: product.name,
    title: `${product.name} — Record once. Edit less.`,
    description:
      "Automatic zooms, camera, local AI and MCP control from Claude or Codex in one open-source macOS studio.",
    url: site.SITE_URL,
    images: [
      {
        url: site.SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        alt: `${product.name} — Record once. Shape every moment.`,
      },
    ],
  },
  twitter: { card: "summary_large_image", images: [site.SOCIAL_IMAGE] },
};

export const viewport: Viewport = { themeColor: "#f7f8f3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
        <VercelAnalytics />
      </body>
    </html>
  );
}
