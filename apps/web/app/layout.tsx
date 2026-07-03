import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
    title: "אולטרנט | מערכת ניהול",
    description: 'מערכת ניהול מאוחדת — סניפים, השכרות, הנה"ח',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
          <html lang="he" dir="rtl">
            <body><Providers>{children}</Providers></body></html>
        );
}
