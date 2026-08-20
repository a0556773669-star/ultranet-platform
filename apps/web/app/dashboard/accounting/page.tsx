import { redirect } from "next/navigation";

/**
 * "הנה"ח" in the top nav lands here. The overview screen is the module's home; the old
 * income/expense entry screen moved to /dashboard/accounting/entries ("רישום ותנועות").
 */
export default function AccountingHomePage() {
  redirect("/dashboard/accounting/overview");
}
