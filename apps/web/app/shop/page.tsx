import type { Metadata } from "next";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getLogoSrc } from "@/lib/branding";
import type { ShopAddon, ShopComputerConfig } from "@ultranet/shared-types";
import { ShopChatClient } from "./shop-chat-client";

// דף ציבורי שקורא נתונים חיים (קטלוג/לוגו) מ-Firestore בכל בקשה - לא לבנות אותו כדף סטטי בזמן build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "בניית מחשב מותאם אישית - אולטרנט",
  description: "ספרו לנו למה אתם צריכים מחשב, והעוזר החכם של אולטרנט יציע לכם תצורה מותאמת אישית.",
};

export default async function ShopPage() {
  const db = getAdminFirestore();
  let logoUrl = "";
  let catalog: ShopComputerConfig[] = [];
  let addons: ShopAddon[] = [];

  try {
    const [logoSrc, catalogSnap, addonsSnap] = await Promise.all([
      getLogoSrc(),
      db.collection("n_shop_catalog").where("active", "==", true).get(),
      db.collection("n_shop_addons").where("active", "==", true).get(),
    ]);
    logoUrl = logoSrc ?? "";
    catalog = catalogSnap.docs.map((d) => ({ ...(d.data() as Omit<ShopComputerConfig, "id">), id: d.id }));
    addons = addonsSnap.docs.map((d) => ({ ...(d.data() as Omit<ShopAddon, "id">), id: d.id }));
  } catch {
    // אם עוד אין קטלוג/לוגו מוגדרים - הצ'אט ממשיך לעבוד עם מפרט גנרי בלבד
  }

  return <ShopChatClient logoUrl={logoUrl} catalog={catalog} addons={addons} />;
}
