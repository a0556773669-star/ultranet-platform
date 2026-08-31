import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { loadBranchAccountingRawData, currentMonth } from "@/lib/branch-accounting-data";
import {
  buildBranchMonthReport,
  loadReportLogoUrl,
  monthLabel,
  renderBranchMonthReportHtml,
} from "@/lib/branch-month-report";

/**
 * Exactly what the partner would receive, rendered in the browser. Needs no mail configuration
 * at all - the point is to approve the design before anything is ever sent.
 * The report is dropped into an iframe srcDoc because it's a full standalone HTML document with
 * its own <body> styling, which must not leak into (or inherit from) the dashboard shell.
 */
export default async function ReportPreviewPage({
  searchParams,
}: {
  searchParams?: { branchId?: string; month?: string };
}) {
  const session = await requireOwner();
  const raw = await loadBranchAccountingRawData();
  const branches = raw.branches.filter((b) => b.branchType === "rentals" && !b.deleted);

  const month = /^\d{4}-\d{2}$/.test(searchParams?.month ?? "") ? (searchParams!.month as string) : currentMonth();
  const branch = searchParams?.branchId ? branches.find((b) => b.id === searchParams.branchId) : branches[0];

  const backHref = `/dashboard/settlement?month=${month}`;

  if (!branch) {
    return (
      <div className="max-w-2xl">
        <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-teal hover:underline">
          <ArrowRight className="h-4 w-4" />
          {'חזרה להנה"ח'}
        </Link>
        <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
          אין סניפי השכרות פעילים להצגה
        </div>
      </div>
    );
  }

  const [logoUrl, ownerName] = await Promise.all([loadReportLogoUrl(), getOwnerName(session.user?.name)]);
  const report = buildBranchMonthReport(branch, raw, month);
  const html = renderBranchMonthReportHtml(report, { logoUrl, ownerName });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-bold text-teal hover:underline">
            <ArrowRight className="h-4 w-4" />
            {'חזרה להנה"ח'}
          </Link>
          <h1 className="mt-1 text-[21px] font-extrabold text-ink">תצוגה מקדימה של הדו&quot;ח החודשי</h1>
          <p className="text-sm text-muted">
            {branch.name} · {monthLabel(month)} — כך בדיוק ייראה המייל שיישלח
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/settlement/report-preview?branchId=${b.id}&month=${month}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                b.id === branch.id
                  ? "border-teal bg-teal text-white"
                  : "border-card-border bg-white text-ink hover:bg-[#f1f5f9]"
              }`}
            >
              {b.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <iframe title="תצוגה מקדימה של הדוח" srcDoc={html} className="h-[900px] w-full border-0" />
      </div>
    </div>
  );
}
