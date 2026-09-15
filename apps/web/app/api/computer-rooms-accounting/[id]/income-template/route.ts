import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { buildBranchIncomeTemplateWorkbook, isBranchIncomeImportEnabled } from "@/lib/branch-income-excel";

/** תבנית האקסל למילוי ההכנסות החודשיות של סניף חדר מחשבים אחד. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isBranchIncomeImportEnabled()) {
    return new NextResponse("ייבוא ההכנסות אינו פעיל", { status: 404 });
  }
  // אותה בדיקת הרשאה בדיוק כמו במסך ובפעולת הייבוא - שותף מוריד תבנית לסניף שלו בלבד.
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const isOwner = role === "owner";
  if (!session || (!isOwner && !(role === "partner" && session.user?.branchId === params.id))) {
    return new NextResponse("אין הרשאה", { status: 403 });
  }

  const doc = await getAdminFirestore().collection("n_branches").doc(params.id).get();
  const branch = doc.exists ? ({ ...(doc.data() as Omit<Branch, "id">), id: doc.id } as Branch) : null;
  if (!branch || branch.deleted || branch.branchType !== "computers") {
    return new NextResponse("סניף לא נמצא", { status: 404 });
  }

  const buffer = buildBranchIncomeTemplateWorkbook(branch.name);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // שם הקובץ נשאר ASCII בכותרת עצמה, והשם בעברית נשלח ב-filename* (RFC 5987).
      "Content-Disposition": `attachment; filename="branch-income-template.xlsx"; filename*=UTF-8''${encodeURIComponent(
        `הכנסות חודשיות - ${branch.name}.xlsx`,
      )}`,
    },
  });
}
