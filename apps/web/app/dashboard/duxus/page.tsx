import { redirect } from "next/navigation";

/**
 * הכניסה למודול "משימות ונהלים" נופלת על המשימות (סלעים ואבני דרך) - זה מסך
 * העבודה היומיומי. הנהלים הם תת-חלק שני, ב-`/dashboard/duxus/procedures`.
 */
export default function DuxusIndexPage() {
  redirect("/dashboard/duxus/rocks");
}
