import { redirect } from "next/navigation";

/**
 * "העברות חודשיות" הייתה מסך בפני עצמו והיא היום החצי השמאלי של `/dashboard/accounting/mobile`.
 * הכתובת נשארת חיה בשביל קישורים שנשלחו במייל ובשביל סימניות: מי שמגיע לכאן מועבר לשם,
 * עם החודש שביקש.
 */
export default function TransfersRedirect({ searchParams }: { searchParams?: { month?: string } }) {
  const month = searchParams?.month;
  redirect(`/dashboard/accounting/mobile${month ? `?month=${encodeURIComponent(month)}` : ""}`);
}
