"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import { roundPrice } from "@/lib/rental-pricing";
import type { BranchRentalPricing } from "@ultranet/shared-types";

function priceField(formData: FormData, key: string): number {
  return roundPrice(Number(formData.get(key)) || 0);
}

/**
 * שומר את מחירון ברירת המחדל של סניף השכרות. הבעלים יכול לערוך כל סניף;
 * מנהל סניף - רק את הסניף שהוא משוייך אליו.
 */
export async function saveBranchPricingAction(branchId: string, formData: FormData) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  if (!branchId) throw new Error("לא נבחר סניף");
  if (role !== "owner" && session.user?.branchId !== branchId) {
    throw new Error("אין לך הרשאה לערוך את המחירון של הסניף הזה");
  }

  const rentalPricing: BranchRentalPricing = {
    laptop: {
      dayPrice: priceField(formData, "dayPrice"),
      weekPrice: priceField(formData, "weekPrice"),
      monthPrice: priceField(formData, "monthPrice"),
      noInternetDayPrice: priceField(formData, "noInternetDayPrice"),
      noInternetWeekPrice: priceField(formData, "noInternetWeekPrice"),
      noInternetMonthPrice: priceField(formData, "noInternetMonthPrice"),
    },
    stick: {
      day1: priceField(formData, "stickDay1"),
      day2: priceField(formData, "stickDay2"),
      day3plus: priceField(formData, "stickDay3plus"),
      weekPrice: priceField(formData, "stickWeekPrice"),
      monthPrice: priceField(formData, "stickMonthPrice"),
    },
  };

  await getAdminFirestore().collection("n_branches").doc(branchId).set({ rentalPricing }, { merge: true });
  revalidatePath("/dashboard/rentals", "layout");
  return { ok: true as const };
}
