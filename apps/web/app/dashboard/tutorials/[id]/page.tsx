import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTutorial, deleteTutorialAction } from "../actions";
import PrintButton from "./print-button";
import DeleteButton from "./delete-button";

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
      if (parts[0] === "shorts" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
  } catch {
    return null;
  }
  return null;
}

export default async function TutorialDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";
  const tutorial = await getTutorial(params.id);
  if (!tutorial) notFound();

  const boundDelete = deleteTutorialAction.bind(null, tutorial.id);
  const embedUrl = tutorial.videoUrl ? toEmbedUrl(tutorial.videoUrl) : null;

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
        {embedUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-card-border">
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        <div
          className="text-[15px] leading-[1.9] text-ink [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
          dangerouslySetInnerHTML={{ __html: tutorial.instructions }}
        />
        {tutorial.attachmentDataUrl ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <a
              href={tutorial.attachmentDataUrl}
              download={tutorial.attachmentName || "attachment"}
              className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-ink hover:bg-teal-bg"
            >
              {"⬇ הורדת קובץ מצורף"}
            </a>
            <a
              href={tutorial.attachmentDataUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-ink hover:bg-teal-bg"
            >
              {"🖨 פתיחה/הדפסה"}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
