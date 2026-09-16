import { redirect } from "next/navigation";

/**
 * "מעקב סניפים ניידים" הייתה מסך בפני עצמו והיא היום החצי הימני של
 * `/dashboard/accounting/mobile`. הכתובת נשארת חיה בשביל סימניות.
 */
export default function LaptopBranchesRedirect({ searchParams }: { searchParams?: { end?: string } }) {
  const end = searchParams?.end;
  redirect(`/dashboard/accounting/mobile${end ? `?end=${encodeURIComponent(end)}` : ""}`);
}
