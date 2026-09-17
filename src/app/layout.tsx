import type { Metadata, Viewport } from "next";
import Script from "next/script";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { umamiConfig } from "@/lib/observability";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flare Ledger",
  description:
    "Log a flare in seconds. Build a record your doctor can read, without daily check-ins.",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6f6a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const umami = umamiConfig();
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
        {umami ? (
          <Script
            src={umami.url}
            data-website-id={umami.websiteId}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
