import type { Metadata, Viewport } from "next";
// import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";

// const heebo = ...

import { getAdminFirestore } from "@/lib/firebase-admin";

export const viewport: Viewport = {
  themeColor: "#1a2332",
};

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
    manifest: "/manifest.webmanifest",
    icons: {
      icon: logoUrl ? logoUrl : "/icons/icon-512.png",
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "אולטרנט",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className=''>
      <body className="font-sans bg-[#f0f2f5] text-[#1a2332]"><PwaRegister /><Providers>{children}</Providers></body></html>
  );
}
