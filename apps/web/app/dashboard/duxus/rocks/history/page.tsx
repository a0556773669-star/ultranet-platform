import { redirect } from "next/navigation";

/** ההיסטוריה עלתה לרמת המודול (סעיף 7 באפיון). הנתיב הישן נשמר לקישורים קיימים. */
export default function LegacyRocksHistoryPage() {
  redirect("/dashboard/duxus/history");
}
