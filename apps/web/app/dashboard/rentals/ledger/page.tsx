import { redirect } from "next/navigation";

/** "חישוב הנה"ח" merged into the unified "הנה"ח" table - keep the old URL alive as a redirect. */
export default function RentalsLedgerPage() {
  redirect("/dashboard/rentals/accounting");
}
