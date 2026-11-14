import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { PlatformShell } from "@/components/layout/PlatformShell";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "REZAVANTIS — Atmospheric Intelligence",
  description:
    "Beyond weather. Into atmosphere. Explore atmospheric intelligence through science, data, and design.",
  applicationName: "REZAVANTIS",
  keywords: [
    "weather",
    "atmosphere",
    "weather intelligence",
    "forecast",
    "environment",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070b13",
};

const themeScript = `
  try {
    const stored = localStorage.getItem("rezavantis-theme");
    if (stored) {
      const parsed = JSON.parse(stored);
      const theme = parsed?.state?.theme;

      if (theme === "dark" || theme === "light") {
        document.documentElement.dataset.theme = theme;
      }
    }
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <PlatformShell>{children}</PlatformShell>
        </Providers>
      </body>
    </html>
  );
}
