import { redirect } from "next/navigation";
import { STOCK_MODULE_HIDDEN } from "@/lib/feature-flags";

export default function OperationsIndexPage() {
  redirect(STOCK_MODULE_HIDDEN ? "/dashboard/operations/tasks" : "/dashboard/operations/stock");
}
