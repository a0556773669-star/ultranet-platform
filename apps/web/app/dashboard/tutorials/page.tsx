import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveModuleScope } from "@/lib/perms";
import { listTutorials } from "./actions";
import { listVisibleProcedures } from "../duxus/actions";
import { LibraryClient, type LibraryItem } from "./library-client";

/**
 * "נהלים והדרכות" (אפיון שדרוג v2, סעיף 12). ההדרכות — לכל מחובר, כמו קודם. הנהלים — רק אלה
 * שהמשתמש רשאי לראות (`canViewProcedure`), ורק בתוקף: טיוטות, גרסאות שהוחלפו וארכיון נשארים
 * במסך הניהול של הנהלים. מי שמנהל נהלים (duxus) מגיע מכאן גם לניהול.
 */
export default async function TutorialsPage() {
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";
  const canManageProcedures = session ? resolveModuleScope(session, "duxus").granted : false;
  const [tutorials, procedures] = await Promise.all([listTutorials(), listVisibleProcedures()]);

  const items: LibraryItem[] = [
    ...procedures
      .filter((p) => (p.status ?? "active") === "active")
      .map((p) => ({
        kind: "procedure" as const,
        id: p.id,
        title: p.title,
        summary: p.summary,
        category: p.category,
        href: `/dashboard/tutorials/procedures/${p.id}`,
      })),
    ...tutorials.map((t) => ({
      kind: "tutorial" as const,
      id: t.id,
      title: t.title,
      imageDataUrl: t.imageDataUrl,
      href: `/dashboard/tutorials/${t.id}`,
    })),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">{"נהלים והדרכות"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canManageProcedures && (
            <Link href="/dashboard/duxus/procedures" className="btn-outline">
              {"ניהול נהלים"}
            </Link>
          )}
          {isOwner && (
            <Link
              href="/dashboard/tutorials/new"
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              {"+ הדרכה חדשה"}
            </Link>
          )}
        </div>
      </div>
      <LibraryClient items={items} />
    </div>
  );
}
