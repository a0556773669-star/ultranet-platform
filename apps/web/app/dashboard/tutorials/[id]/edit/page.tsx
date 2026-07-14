import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTutorial, updateTutorialAction } from "../../actions";
import { RichEditor } from "../../rich-editor";
import { AttachmentField } from "../../attachment-field";

export default async function EditTutorialPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/tutorials");

  const tutorial = await getTutorial(params.id);
  if (!tutorial) notFound();

  const boundUpdate = updateTutorialAction.bind(null, tutorial.id);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">{"עריכת הדרכה"}</h1>
      <form action={boundUpdate} className="card flex max-w-xl flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"כותרת"}</label>
          <input
            type="text"
            name="title"
            required
            defaultValue={tutorial.title}
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"הוראות"}</label>
          <RichEditor name="instructions" defaultValue={tutorial.instructions} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"קישור לסרטון (יוטיוב / דרייב)"}</label>
          <input
            type="text"
            name="videoUrl"
            defaultValue={tutorial.videoUrl}
            placeholder="https://youtu.be/... או https://drive.google.com/..."
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"קובץ מצורף (PDF / Word)"}</label>
          <AttachmentField currentName={tutorial.attachmentName} />
        </div>
        <button
          type="submit"
          className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          {"עדכון"}
        </button>
      </form>
    </div>
  );
}
