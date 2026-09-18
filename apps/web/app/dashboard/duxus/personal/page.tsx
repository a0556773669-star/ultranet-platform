import { Target } from "lucide-react";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { loadPersonalBoard } from "./actions";
import { PersonalClient } from "./personal-client";

/**
 * טאב "משימות ליוני" - רשימת העבודה האישית שהמזכירה מזינה אליה ויוני מסמן ממנה.
 *
 * מעבר להרשאת המודול נבדקת כאן גם הגישה האישית לטאב: מי שאינו ברשימות ההרשאה
 * מוחזר לרשימת המשימות הרגילה ואינו מקבל אף שורת דאטה (קריטריון קבלה 9).
 */
export default async function PersonalTasksPage() {
  await requireModuleAccess("duxus");
  const board = await loadPersonalBoard();
  if (board.access === "none") redirect("/dashboard/duxus/rocks/week");

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <PersonalClient board={board} />
    </div>
  );
}
