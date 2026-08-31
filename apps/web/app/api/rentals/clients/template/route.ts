import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/perms";
import { buildClientsTemplateWorkbook } from "@/lib/client-excel";

export async function GET() {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const buffer = buildClientsTemplateWorkbook(isOwner);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="clients-import-template.xlsx"',
    },
  });
}
