import { redirect } from "next/navigation";

/**
 * הכניסה ל"משימות ויעדים" נופלת על מסך השבוע - מה שעושים עכשיו נמצא ראשון
 * (סעיף 7 באפיון: השבוע, החודש, הרבעון, ארכיון).
 */
export default function TasksIndexPage({ searchParams }: { searchParams: { q?: string } }) {
  redirect(searchParams.q ? `/dashboard/duxus/rocks/week?q=${encodeURIComponent(searchParams.q)}` : "/dashboard/duxus/rocks/week");
}
