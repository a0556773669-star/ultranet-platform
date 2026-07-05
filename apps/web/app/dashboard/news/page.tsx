import { getNewsSnapshotAction } from "./actions";
import { NewsClient } from "./news-client";

export default async function NewsPage() {
  const snapshot = await getNewsSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">📢 עדכונים</h1>
      <NewsClient snapshot={snapshot} />
    </div>
  );
}
