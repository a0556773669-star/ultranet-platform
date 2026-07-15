import { Megaphone } from "lucide-react";
import { getNewsSnapshotAction } from "./actions";
import { NewsClient } from "./news-client";

export default async function NewsPage() {
  const snapshot = await getNewsSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Megaphone className="h-5 w-5" />עדכונים</h1>
      <NewsClient snapshot={snapshot} />
    </div>
  );
}
