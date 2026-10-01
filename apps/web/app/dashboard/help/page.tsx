import Link from "next/link";
import { getServerSession } from "next-auth";
import { LifeBuoy, ListChecks } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { helpScopeFor, MODULE_LABELS } from "@/lib/help/knowledge";
import { assistantConfigured } from "@/lib/help/assistant";
import { HelpClient } from "./help-client";

/** סרטון ההדרכה של כל קהל — קבצים סטטיים ב-`public/help-videos`. */
const VIDEOS = {
  owner: { src: "/help-videos/owner.mp4", title: "סרטון הדרכה — המערכת המלאה (בעלים ומזכירות)" },
  renter: { src: "/help-videos/renter.mp4", title: "סרטון הדרכה — ניהול סניף השכרות" },
} as const;

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  const scope = helpScopeFor(session);
  const isOwner = scope.audience === "owner";

  // קיבוץ השאלות לפי מודול, בסדר ההופעה בתפריט.
  const groups = Object.keys(MODULE_LABELS)
    .map((module) => ({
      module,
      label: MODULE_LABELS[module] ?? module,
      faqs: scope.faqs
        .filter((f) => f.module === module)
        .map(({ id, question, answer, tags }) => ({ id, question, answer, tags })),
    }))
    .filter((g) => g.faqs.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <LifeBuoy className="h-5 w-5" />
            {"עזרה ושאלות"}
          </h1>
          <p className="text-sm text-muted">
            {"לא בטוחים איך עושים משהו? שאלו כאן במילים שלכם וקבלו תשובה מיד."}
          </p>
        </div>
        {isOwner && (
          <Link href="/dashboard/help/questions" className="btn-outline flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            {"שאלות שנשאלו"}
          </Link>
        )}
      </div>

      <HelpClient
        groups={groups}
        aiEnabled={assistantConfigured()}
        video={VIDEOS[scope.audience]}
      />
    </div>
  );
}
