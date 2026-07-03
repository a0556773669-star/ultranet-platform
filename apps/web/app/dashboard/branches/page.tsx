import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";

const TYPE_LABELS: Record<string, string> = {
  computers: "מחשבים",
  rentals: "השכרות",
  coworking: "קוורקינג",
};

async function listBranches(): Promise<Branch[]> {
  const snap = await getAdminFirestore().collection("n_branches").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export default async function BranchesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const all = await listBranches();
  const branches =
    role === "owner" ? all : all.filter((b) => b.id === myBranchId || b.parentBranchId === myBranchId);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">סניפים</h1>
        {role === "owner" && (
          <Link
            href="/dashboard/branches/new"
            className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark"
          >
            + סניף חדש
          </Link>
        )}
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-gray-500">אין סניפים להצגה.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">שם</th>
                <th className="px-4 py-3 font-medium">סוג</th>
                <th className="px-4 py-3 font-medium">מיקום</th>
                <th className="px-4 py-3 font-medium">שותף</th>
                <th className="px-4 py-3 font-medium">אחוז שלי</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/branches/${b.id}`} className="font-medium text-teal-dark hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[b.branchType] ?? b.branchType}</td>
                  <td className="px-4 py-3 text-gray-600">{b.location ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{b.isMine ? "בבעלות מלאה" : (b.partnerName ?? "-")}</td>
                  <td className="px-4 py-3 text-gray-600">{b.isMine ? "100%" : `${b.myPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
