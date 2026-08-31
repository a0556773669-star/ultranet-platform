import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTutorials } from "./actions";

export default async function TutorialsPage() {
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";
  const tutorials = await listTutorials();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">{"הדרכות"}</h1>
        {isOwner && (
          <Link
            href="/dashboard/tutorials/new"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            {"+ הדרכה חדשה"}
          </Link>
        )}
      </div>

      {tutorials.length === 0 ? (
        <div className="card text-sm text-muted">
          {isOwner ? "עדיין אין הדרכות. לחצו על כפתור ההוספה כדי להוסיף." : "עדיין אין הדרכות זמינות."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/tutorials/${t.id}`}
              className="card flex flex-col gap-2 overflow-hidden transition hover:shadow-lg"
            >
              {t.imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.imageDataUrl}
                  alt={t.title}
                  className="h-32 w-full rounded-lg border border-card-border object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg border border-card-border bg-[#f4f6f9]">
                  <BookOpen className="h-8 w-8 text-muted" />
                </div>
              )}
              <div className="text-sm font-bold text-ink">{t.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
