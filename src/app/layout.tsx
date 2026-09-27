import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const viewport: Viewport = {
  themeColor: "#e8a100",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "RattaMaro — Practice. Remember. Master.",
    template: "%s · RattaMaro",
  },
  description:
    "Curated BPSC question bank with timed tests, negative marking, spaced repetition, and honest progress tracking.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RattaMaro",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
