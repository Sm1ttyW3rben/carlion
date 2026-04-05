import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
