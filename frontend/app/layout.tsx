import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../tokens/tokens.generated.css";
import "./globals.css";

// Inter and Inter Tight are self-hosted so field workers on poor connections never wait on a CDN (BRD 1.3 Assumption 2).
const inter = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const interTight = localFont({
  src: "./fonts/InterTight-latin-variable.woff2",
  variable: "--font-inter-tight",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Olannah",
  description: "Olannah canvas",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  );
}
