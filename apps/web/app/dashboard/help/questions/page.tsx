import Link from "next/link";
import type { HelpQuestion } from "@ultranet/shared-types";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";

const SOURCE_LABEL: Record<HelpQuestion["source"], string> = {
  ai: "עוזר חכם",
  faq: "שאלה נפוצה",
  none: "לא נמצאה תשובה",
};

/**
 * כל השאלות שנשאלו במרכז העזרה — כדי לראות במה המזכירה והמשכירים נתקעים. שאלה שסומנה
 * "לא עזר" או שלא נמצאה לה תשובה היא הרמז הכי טוב למה כדאי להסביר טוב יותר.
 */
export default async function HelpQuestionsPage({ searchParams }: { searchParams: { filter?: string } }) {
  await requireOwner();
  const onlyProblems = searchParams.filter === "problems";

  const snap = await getAdminFirestore().collection("n_help_questions").orderBy("createdAt", "desc").limit(300).get();
  const all = snap.docs.map((d) => ({ ...(d.data() as HelpQuestion), id: d.id }));
  const rows = onlyProblems ? all.filter((q) => q.helpful === false || q.source === "none") : all;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-extrabold text-ink">{"שאלות שנשאלו במרכז העזרה"}</h1>
          <p className="text-sm text-muted">{"300 השאלות האחרונות, מכל המשתמשים."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/help/questions" className={onlyProblems ? "pill-inactive" : "pill-active"}>
            {"הכל"}
          </Link>
          <Link href="/dashboard/help/questions?filter=problems" className={onlyProblems ? "pill-active" : "pill-inactive"}>
            {"לא עזר / בלי תשובה"}
          </Link>
          <Link href="/dashboard/help" className="btn-outline">
            {"חזרה לעזרה"}
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card text-sm text-muted">{"עדיין לא נשאלו שאלות."}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f9fb] text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-right">{"תאריך"}</th>
                <th className="px-3 py-2 text-right">{"מי שאל"}</th>
                <th className="px-3 py-2 text-right">{"שאלה"}</th>
                <th className="px-3 py-2 text-right">{"תשובה"}</th>
                <th className="px-3 py-2 text-right">{"מקור"}</th>
                <th className="px-3 py-2 text-right">{"עזר?"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className={`border-t border-card-border align-top ${q.helpful === false || q.source === "none" ? "bg-red-50/50" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {new Date(q.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium text-ink">{q.userName || q.userEmail}</div>
                    <div className="text-muted">{q.audience === "owner" ? "בעלים / מזכירה" : "משכיר"}</div>
                  </td>
                  <td className="max-w-[260px] px-3 py-2 font-medium text-ink">{q.question}</td>
                  <td className="max-w-[420px] px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-teal-dark">{"הצג תשובה"}</summary>
                      <p className="mt-1 whitespace-pre-line text-xs text-ink">{q.answer}</p>
                    </details>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{SOURCE_LABEL[q.source] ?? q.source}</td>
                  <td className="px-3 py-2 text-xs">{q.helpful === undefined ? "—" : q.helpful ? "👍" : "👎"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
