import { redirect } from "next/navigation";

/** הטאב השבועי התמזג ללוח העבודה (קומת השבוע). נשאר כהפניה לקישורים ישנים. */
export default function RocksWeekRedirect() {
  redirect("/dashboard/duxus/rocks");
}
