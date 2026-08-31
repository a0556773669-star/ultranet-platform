"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ShopRecommendedOption, ShopTier, ShopUseCase } from "@ultranet/shared-types";
import { USE_CASE_LABELS } from "@/lib/shop-recommender";

export interface CreateShopLeadInput {
  useCase: ShopUseCase;
  description: string;
  answers: { question: string; answer: string }[];
  loadLevel: number;
  recommendedOptions: ShopRecommendedOption[];
  selectedTier: ShopTier;
  selectedAddonNames: string[];
  contactName?: string;
  contactEmail: string;
  contactPhone: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createShopLeadAction(input: CreateShopLeadInput): Promise<{ id: string }> {
  const contactEmail = input.contactEmail.trim();
  const contactPhone = input.contactPhone.trim().replace(/[^\d+]/g, "");
  const contactName = input.contactName?.trim();

  if (!EMAIL_RE.test(contactEmail)) {
    throw new Error("כתובת אימייל לא תקינה");
  }
  if (contactPhone.replace(/\D/g, "").length < 9) {
    throw new Error("מספר טלפון לא תקין");
  }

  const db = getAdminFirestore();
  const doc = await db.collection("n_shop_leads").add({
    createdAt: new Date().toISOString(),
    useCase: input.useCase,
    useCaseLabel: USE_CASE_LABELS[input.useCase],
    loadLevel: input.loadLevel,
    description: input.description,
    answers: input.answers,
    recommendedOptions: input.recommendedOptions,
    selectedTier: input.selectedTier,
    selectedAddonNames: input.selectedAddonNames,
    ...(contactName ? { contactName } : {}),
    contactEmail,
    contactPhone,
    status: "new",
  });

  return { id: doc.id };
}
