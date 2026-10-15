/**
 * קריאת בחירת הסניפים מהכתובת (`?b=id,id`, ראו `components/branch-picker.tsx`) בצד השרת. מחזיר רק
 * מזהים שנמצאים ברשימת המותרים — כתובת שנערכה ידנית לא יכולה להרחיב הרשאה. ריק = כל המותרים.
 */
export function parseBranchSelection(raw: string | undefined, allowedIds: string[]): string[] {
  if (!raw) return [];
  const allowed = new Set(allowedIds);
  return raw.split(",").filter((id) => allowed.has(id));
}
