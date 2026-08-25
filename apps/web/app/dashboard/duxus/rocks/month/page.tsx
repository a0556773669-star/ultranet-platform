import { redirect } from "next/navigation";

/** הטאב החודשי התמזג ללוח העבודה (קומת החודש). נשאר כהפניה לקישורים ישנים. */
export default function RocksMonthRedirect() {
  redirect("/dashboard/duxus/rocks");
}
