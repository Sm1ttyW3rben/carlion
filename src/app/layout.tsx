import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/shared/components/providers";

export const metadata: Metadata = {
  title: "Carlion",
  description: "AI-gesteuertes Betriebssystem für Autohändler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
