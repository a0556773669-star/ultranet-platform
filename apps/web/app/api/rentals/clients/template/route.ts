import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/perms";
import { buildClientsTemplateWorkbook } from "@/lib/client-excel";

export async function GET() {
  try {
    return await handler();
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), stack: (err as Error)?.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handler() {
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
