import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300", "400", "500", "700", "800"], variable: "--font-heebo" });

import { getAdminFirestore } from "@/lib/firebase-admin";

export async function generateMetadata(): Promise<Metadata> {
  let logoUrl = "";
  try {
    const doc = await getAdminFirestore().collection("n_label_settings").doc("default").get();
    logoUrl = String((doc.data() as { logoUrl?: string } | undefined)?.logoUrl ?? "");
  } catch {
    logoUrl = "";
  }
  return {
    title: "אולטרנט מערכת ניהול",
    description: "אולטרנט מערכת ניהול - סניפים, השכרות, וחדרות מחשבים",
    icons: logoUrl ? { icon: logoUrl } : undefined,
  };
}

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
