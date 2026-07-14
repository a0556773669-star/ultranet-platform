import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTutorial, deleteTutorialAction } from "../actions";
import PrintButton from "./print-button";
import DeleteButton from "./delete-button";

export default async function TutorialDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";
  const tutorial = await getTutorial(params.id);
  if (!tutorial) notFound();

  const boundDelete = deleteTutorialAction.bind(null, tutorial.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard/tutorials" className="text-sm font-semibold text-teal hover:underline">
          {"→ חזרה להדרכות"}
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          {isOwner && (
            <>
              <Link
                href={`/dashboard/tutorials/${tutorial.id}/edit`}
                className="rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
              >
                {"עריכה"}
              </Link>
              <form action={boundDelete}>
                <DeleteButton />
              </form>
            </>
          )}
        </div>
      </div>

      <div className="card flex flex-col gap-4">
        <h1 className="text-xl font-bold text-ink">{tutorial.title}</h1>
        {tutorial.imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tutorial.imageDataUrl}
            alt={tutorial.title}
            className="w-full rounded-lg border border-card-border object-contain"
          />
        )}
        <div
            className="text-sm leading-relaxed text-ink [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
            dangerouslySetInnerHTML={{ __html: tutorial.instructions }}
          />
      </div>
    </div>
  );
}
