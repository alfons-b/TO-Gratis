import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/utils";

export const metadata: Metadata = {
  title: `Try Out SKD CPNS · ${APP_NAME}`,
  description: `Simulasi Try Out SKD CPNS gratis oleh ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b2f57",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
