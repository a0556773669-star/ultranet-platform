import { redirect } from "next/navigation";

/**
 * הכניסה למודול "משימות ונהלים" נופלת על המשימות - זה מסך העבודה היומיומי.
 * הנהלים, ההיסטוריה וההגדרות הם הלשוניות הנוספות של האזור.
 */
export default function DuxusIndexPage() {
  redirect("/dashboard/duxus/rocks/week");
}
