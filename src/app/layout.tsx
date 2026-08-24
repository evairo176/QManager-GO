import type { Metadata } from "next";
import "./globals.css";

import { Manrope, JetBrains_Mono } from "next/font/google";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QManager",
  description:
    "QManager is a modern web-based GUI for managing Quectel modems — from APN and band locking to advanced diagnostics and cellular device management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${manrope.variable} ${jetbrainsMono.variable} ${manrope.className} antialiased`}>
        {/* reducedMotion="user" makes every motion/react animation in the app
            honor prefers-reduced-motion automatically: transform/layout movement
            collapses to instant while opacity is preserved, so the UI stays
            intentional (a clean cross-fade) rather than broken. This is the
            single global switch the motion system relies on. */}
        <MotionConfig reducedMotion="user">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <I18nProvider>
              {children}
              <Toaster />
            </I18nProvider>
          </ThemeProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
