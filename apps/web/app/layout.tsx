import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300", "400", "500", "700", "800"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "אולטרנט | מערכת ניהול",
  description: "מערכת ניהול תוכשה - סיפינט, תורכשה, טיפינט תוריחות",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans bg-[#f0f2f5] text-[#1a2332]"><Providers>{children}</Providers></body></html>
  );
}
