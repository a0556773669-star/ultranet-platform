import * as XLSX from "xlsx";
import type { RentalClient } from "@ultranet/shared-types";

export const CLIENT_XLSX_HEADERS = {
  branch: "סניף",
  name: "שם",
  phone: "טלפון",
  email: "מייל",
  idNum: "ת.ז",
  address: "כתובת",
  signedTerms: "חתם על תקנון",
  depositType: "פיקדון",
  cardSaved: "כרטיס שמור (מידע בלבד)",
} as const;

const DEPOSIT_LABEL: Record<NonNullable<RentalClient["depositType"]>, string> = {
  none: "ללא פיקדון",
  check: "צ'ק",
  credit: "אשראי",
};

function depositToLabel(v?: RentalClient["depositType"]) {
  return DEPOSIT_LABEL[v ?? "none"];
}

function labelToDeposit(raw: string): NonNullable<RentalClient["depositType"]> {
  const v = raw.trim();
  if (v.includes("צ'ק") || v.includes('צ"ק') || v.includes("צ״ק")) return "check";
  if (v.includes("אשראי")) return "credit";
  return "none";
}

export function buildClientsExportWorkbook(
  clients: RentalClient[],
  branchNameById: Record<string, string>,
  includeBranchColumn: boolean
): Buffer {
  const headers = [
    ...(includeBranchColumn ? [CLIENT_XLSX_HEADERS.branch] : []),
    CLIENT_XLSX_HEADERS.name,
    CLIENT_XLSX_HEADERS.phone,
    CLIENT_XLSX_HEADERS.email,
    CLIENT_XLSX_HEADERS.idNum,
    CLIENT_XLSX_HEADERS.address,
    CLIENT_XLSX_HEADERS.signedTerms,
    CLIENT_XLSX_HEADERS.depositType,
    CLIENT_XLSX_HEADERS.cardSaved,
  ];

  const rows = clients.map((c) => [
    ...(includeBranchColumn ? [branchNameById[c.branchId] ?? "-"] : []),
    c.name ?? "",
    c.phone ?? "",
    c.email ?? "",
    c.idNum ?? "",
    c.address ?? "",
    c.signedTerms ? "כן" : "לא",
    depositToLabel(c.depositType),
    c.gatewayToken ? "כן" : "לא",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "לקוחות");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildClientsTemplateWorkbook(includeBranchColumn: boolean): Buffer {
  const headers = [
    ...(includeBranchColumn ? [CLIENT_XLSX_HEADERS.branch] : []),
    CLIENT_XLSX_HEADERS.name,
    CLIENT_XLSX_HEADERS.phone,
    CLIENT_XLSX_HEADERS.email,
    CLIENT_XLSX_HEADERS.idNum,
    CLIENT_XLSX_HEADERS.address,
    CLIENT_XLSX_HEADERS.signedTerms,
    CLIENT_XLSX_HEADERS.depositType,
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "לקוחות");

  const instructionsRows: string[][] = [
    ["הוראות מילוי הקובץ"],
    [""],
    [`עמודת "${CLIENT_XLSX_HEADERS.name}" היא חובה, שאר העמודות רשות.`],
    [`עמודת "${CLIENT_XLSX_HEADERS.signedTerms}" מקבלת: כן / לא.`],
    [`עמודת "${CLIENT_XLSX_HEADERS.depositType}" מקבלת: ללא פיקדון / צ'ק / אשראי.`],
    ...(includeBranchColumn
      ? [[`עמודת "${CLIENT_XLSX_HEADERS.branch}" חייבת להכיל שם סניף קיים בדיוק כפי שהוא מופיע במערכת.`]]
      : []),
    ["פרטי כרטיס אשראי (מספר כרטיס, CVV) אינם נתמכים בייבוא - הם נשמרים רק דרך נדרים פלוס, מטעמי אבטחה."],
    ["אם יש התאמה לפי ת.ז (או לפי שם, אם אין ת.ז) ללקוח קיים באותו סניף, הפרטים שלו יתעדכנו; אחרת ייווצר לקוח חדש."],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instructionsRows);
  wsInfo["!cols"] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "הוראות");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export interface ParsedClientRow {
  branchName?: string;
  name: string;
  phone?: string;
  email?: string;
  idNum?: string;
  address?: string;
  signedTerms: boolean;
  depositType: NonNullable<RentalClient["depositType"]>;
}

export function parseClientsWorkbook(buf: Buffer): { rows: ParsedClientRow[]; errors: string[] } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return { rows: [], errors: ["לא ניתן לקרוא את הקובץ - ודא שזהו קובץ Excel תקין (xlsx)"] };
  }
  const sheetName = wb.SheetNames.find((n) => n.includes("לקוח")) ?? wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) return { rows: [], errors: ["לא נמצא גיליון נתונים בקובץ"] };

  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (!data.length) return { rows: [], errors: ["הקובץ ריק"] };

  const headerRow = (data[0] as unknown[]).map((h) => String(h ?? "").trim());
  const idx = (label: string) => headerRow.indexOf(label);

  const iBranch = idx(CLIENT_XLSX_HEADERS.branch);
  const iName = idx(CLIENT_XLSX_HEADERS.name);
  const iPhone = idx(CLIENT_XLSX_HEADERS.phone);
  const iEmail = idx(CLIENT_XLSX_HEADERS.email);
  const iIdNum = idx(CLIENT_XLSX_HEADERS.idNum);
  const iAddress = idx(CLIENT_XLSX_HEADERS.address);
  const iSigned = idx(CLIENT_XLSX_HEADERS.signedTerms);
  const iDeposit = idx(CLIENT_XLSX_HEADERS.depositType);

  if (iName === -1) {
    return { rows: [], errors: [`לא נמצאה עמודת "${CLIENT_XLSX_HEADERS.name}" בקובץ`] };
  }

  const rows: ParsedClientRow[] = [];
  const errors: string[] = [];
  const cell = (row: unknown[], i: number) => (i === -1 ? "" : String(row[i] ?? "").trim());

  for (let r = 1; r < data.length; r++) {
    const row = data[r] as unknown[];
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;
    const name = cell(row, iName);
    if (!name) {
      errors.push(`שורה ${r + 1}: חסר שם, השורה דולגה`);
      continue;
    }
    const signedRaw = cell(row, iSigned);
    rows.push({
      branchName: iBranch !== -1 ? cell(row, iBranch) || undefined : undefined,
      name,
      phone: cell(row, iPhone) || undefined,
      email: cell(row, iEmail) || undefined,
      idNum: cell(row, iIdNum) || undefined,
      address: cell(row, iAddress) || undefined,
      signedTerms: signedRaw === "כן" || signedRaw.toLowerCase() === "yes",
      depositType: labelToDeposit(cell(row, iDeposit)),
    });
  }
  return { rows, errors };
}
