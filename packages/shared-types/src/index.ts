// Shared domain types - mirrors the existing Firestore schema used by app.html.
// IMPORTANT: keep collection names and field names in sync with the live app.
// Do not rename fields here without also updating app.html and Firestore data.

export type BranchType = "computers" | "rentals" | "coworking";
export type UserRole = "owner" | "partner" | "employee";
export type CollectionProvider =
    | "manual"
  | "nedarim_plus"
  | "tranzila"
  | "cardcom"
  | "payplus"
  | "meshulam"
  | "other";
export type ReceiptsProvider = "none" | "icount" | "green_invoice" | "ezcount";
export type DepositsTo = "owner" | "branch";
export type RouteStatus = "not_connected" | "connected" | "paused";

/** collection: n_branches */
export interface Branch {
    id: string;
    name: string;
    location?: string;
    phone?: string;
    founded?: string; // ISO date
  branchType: BranchType;
    isMine: boolean;
    partnerName?: string;
    partnerEmail?: string;
    myPct: number;
    partnerPct: number;
  parentPct?: number;
    setupCost?: number;
    notes?: string;
    /** sub-branch model: set when this branch rolls up under a head partner's branch */
  parentBranchId?: string | null;
  collectionRouteId?: string | null;
  allowCollection?: boolean;
  allowReceipts?: boolean;
  /** soft-delete: "deleting" a branch sets this instead of removing the Firestore doc, so its
   *  accounting history (expenses/transfers/income already tied to its branchId) stays intact
   *  and resolvable by name. Every active-branch query in the app must filter this out; only the
   *  accounting history view intentionally includes deleted branches. */
  deleted?: boolean;
  deletedAt?: string;
}

/** collection: n_users */
export interface AppUser {
    id: string;
    name: string;
    email: string;
    pass: string; // legacy plaintext - replace with proper auth before any customer-facing exposure
  role: UserRole;
    branchId: string; // "all" for owner
  perms?: Partial<Record<"branches" | "computers" | "rentals" | "coworking" | "accounting" | "tasks" | "charging" | "shop" | "duxus", boolean>>;
  viewClientBranchIds?: string[];
}

/** collection: n_fixed_expenses */
export interface FixedExpense {
    id: string;
    branchId: string;
    name: string;
    amount?: number;
    variableAmount?: boolean;
    lastAmount?: number;
    startDate: string;
    endDate?: string;
    payer?: string;
  category?: string;
  paidBy?: string;
  owedBy?: string;
}

/** collection: n_var_expenses */
export interface VariableExpense {
    id: string;
    branchId: string;
    amount: number;
    desc: string;
    category?: string;
    payer?: string;
  paidBy?: string;
  owedBy?: string;
    date: string;
    month: string; // YYYY-MM
  /** id of the matching n_ah_expenses doc auto-created for the owner's economic burden
   *  (ownerExpenseBurden of amount/owedBy) when this expense was added; undefined if the
   *  owner's burden was 0 (e.g. owedBy === "partner"). Deleted together with this expense. */
  linkedAhExpenseId?: string;
}

/**
 * collection: n_branch_income (manual/rental/coworking income entries for partner branches).
 * Also used for:
 *  - rentals branches: owner-only manual income log (/dashboard/rentals/expenses/[id]) that IS
 *    merged into the branch's real income figures/partner-settlement calc
 *    (computeBranchFinancials, lib/branch-accounting-data.ts) exactly like a real rental
 *    payment - `collectedByOwner` says who currently holds that cash, same meaning as a real
 *    rental's payment method/route for that calc.
 *  - computer-room branches' monthly income tracking row (/dashboard/computer-rooms-accounting):
 *    one manual row per branch per month, purely for viewing setup-investment vs. profit per
 *    branch - NOT merged into any calculation there.
 * Deliberately NEVER written to n_ah_income in either case - it does not reconcile into the main
 * ledger or the home dashboard totals.
 */
export interface BranchIncome {
    id: string;
    branchId: string;
    amount: number;
    desc: string;
    date: string;
    month: string;
    collectionRouteId?: string | null;
    paymentMethod?: string;
    /** rentals only: true if the owner already personally holds this cash (mirrors
     *  isCollectedByOwner for real rentals) - affects the partner-settlement direction. */
    collectedByOwner?: boolean;
}

/** collection: n_tasks */
export interface Task {
    id: string;
    branchId: string;
    name: string;
    due?: string;
    urgency?: "low" | "med" | "high";
    recurrence?: "none" | "weekly" | "monthly";
    done: boolean;
}

/** collection: n_sub_locations */
export interface SubLocation {
    id: string;
    branchId: string;
    name: string;
}

/** collection: n_devices */
export interface Device {
    id: string;
    branchId: string;
    number: string;
    name: string;
    user?: string;
    pass?: string;
}

/** collection: n_laptops */
export interface Laptop {
    id: string;
    branchId: string;
    name: string;
    dayPrice: number;
    weekPrice: number;
    monthPrice: number;
  hasStick?: boolean;
  simNumber?: string;
  altPricing?: boolean;
  noInternetDayPrice?: number;
  noInternetWeekPrice?: number;
  noInternetMonthPrice?: number;
  /** ISO date - when this computer was added; used for per-computer profit tracking */
  addedDate?: string;
  /** true if a partner (not the owner) gets a cut of this specific computer's rental income */
  hasPartner?: boolean;
  /** free text - who the partner is; falls back to a generic label in the settlement report if empty */
  partnerName?: string;
  /** percent of this computer's (and its linked stick's) rental income owed to the partner; defaults to 15 */
  partnerPct?: number;
}

/** collection: n_sticks */
export interface Stick {
    id: string;
    branchId: string;
    name: string;
    sim?: string;
    /** מחיר היום הראשון */
    day1: number;
    /** מחיר היום השני; 0/ריק = כמו המחיר מהיום השלישי ואילך */
    day2: number;
    /** מחיר לכל יום מהיום השלישי ואילך (המחיר היומי השוטף) */
    day3plus: number;
    /** מחיר לשבוע (רשות; 0/ריק = אין מדרגת שבוע לסטיק הזה) */
    weekPrice?: number;
    /** מחיר לחודש (רשות; 0/ריק = אין מדרגת חודש לסטיק הזה) */
    monthPrice?: number;
    linkedLaptopId?: string | null;
}

/** collection: n_rental_clients */
export interface RentalClient {
    id: string;
    branchId: string;
    name: string;
    phone?: string;
    idNum?: string;
    address?: string;
  email?: string;
  signedTerms?: boolean;
  depositType?: "none" | "check" | "credit";
  cardLast4?: string; // display-only reference, never store full PAN
  cardExpiry?: string; // MM/YY, non-sensitive
  gatewayToken?: string; // set by payment gateway tokenization (Nedarim Plus), never raw card data
  /** n_collection_routes id the saved gatewayToken was tokenized under (which business/merchant
   *  account owns this card-on-file). A token is only valid for the merchant that created it, so
   *  this can't be repointed without the client re-entering their card under a different route.
   *  Unset for clients saved before per-client routing existed - they keep resolving via the
   *  branch's route (see resolveNedarimCreds). */
  collectionRouteId?: string | null;
  referralSource?: string; // free text: how the client found us
}

/** collection: n_rentals */
export interface Rental {
  id: string;
  branchId: string;
  clientId: string;
  itemId: string;
  kind: "laptop" | "stick";
  pricingVariant?: "normal" | "noInternet";
  startDate: string;
  endDate?: string;
  calcPrice: number;
  finalPrice?: number;
  priceOverrideReason?: string;
  notes?: string;
  status: "active" | "returned";
  paid: boolean;
  paymentMethod?: string;
  receiptIssued?: boolean;
  receiptPdfLink?: string;
  collectionRouteId?: string | null;
  pickupLoc?: string;
  returnLoc?: string;
  returnDate?: string;
}

/** collection: n_inventory */
export interface InventoryItem {
    id: string;
    branchId: string;
    name: string;
    qty: number;
    minQty: number;
    unit?: string;
}

/** collection: n_tickets */
export interface Ticket {
    id: string;
    branchId: string;
    desc: string;
    urgency?: "low" | "med" | "high";
    deviceId?: string;
    status: "open" | "resolved";
}

/** collection: n_printers */
export interface Printer {
    id: string;
    branchId: string;
    name: string;
    ip?: string;
    url?: string;
    tonerPct?: number;
    paperStatus?: string;
}

/** collection: n_cw_stations */
export interface CoworkingStation {
    id: string;
    branchId: string;
    name: string;
    price: number;
}

export interface CoworkingPayment {
    month: string;
    amount: number;
    date: string;
    paymentMethod?: string;
    collectionRouteId?: string | null;
}

/** collection: n_cw_clients */
export interface CoworkingClient {
    id: string;
    branchId: string;
    name: string;
    phone?: string;
    stationId: string;
    startDate: string;
    endDate?: string;
    customPrice?: number;
    payDay?: number;
    payments: CoworkingPayment[];
}

/**
 * collection: n_ah_income (owner-only manual accounting).
 * The only income entries that reconcile into the main ledger (and the home dashboard totals)
 * come from 3 manual entry types, entered via /dashboard/accounting:
 *  - "laptops": a laptop-rental branch's income, tied to `branchId` (a `rentals` branch).
 *  - "credit": card-clearing income from the business as a whole (typically logged around the
 *    10th of the month), no `branchId`.
 *  - "cash": cash pulled from a computer-room branch's till, tied to `branchId` (a `computers`
 *    branch = which till/קופה it came from).
 * "fixed"/"variable" are legacy type values kept only so old records still render correctly;
 * new entries are never created with them.
 */
export interface AccountingIncome {
    id: string;
    amount: number;
    desc: string;
    business: "computers" | "rentals" | "coworking" | "other" | "general";
    type: "fixed" | "variable" | "cash" | "laptops" | "credit";
    date: string;
    month: string;
    /** set for type "laptops" (rentals branch) and type "cash" (computers branch / till) */
    branchId?: string;
}

/** collection: n_ah_expenses */
export interface AccountingExpense {
    id: string;
    amount: number;
    desc: string;
    business: "computers" | "rentals" | "coworking" | "general";
    date: string;
    month: string;
}

/** collection: n_collection_routes */
export interface CollectionRoute {
    id: string;
    name: string;
    branchScope: string | null; // null = available to all branches
  provider: CollectionProvider;
    terminalId?: string;
    supplierNumber?: string;
    apiKey?: string;
    apiSecret?: string;
    env?: "production" | "test";
    currency?: string;
    receiptsProvider: ReceiptsProvider;
    receiptsCompanyId?: string;
    receiptsApiKey?: string;
    receiptsApiSecret?: string;
    embedded?: boolean;
    depositsTo: DepositsTo;
    feePct?: number;
    feeFixed?: number;
    notes?: string;
    status: RouteStatus;
    /** if true, this route is pre-selected when staff save a NEW rental client's card or take a
     *  fresh (no-token) charge - lets the owner steer newly-collected revenue to a given business
     *  by default while existing saved cards keep charging through whichever route they were
     *  tokenized under. At most one route should carry this flag. */
    defaultForNewCards?: boolean;
}

/** collection: n_branch_transfers - monthly partner<->owner settlement records */
export interface BranchTransfer {
  id: string;
  branchId: string;
  month: string; // YYYY-MM
  /** positive = partner should transfer this to owner; negative = owner owes partner */
  netToOwner: number;
  incomeShareToOwner: number;
  expenseNetToOwner: number;
  transferred: boolean;
  transferredAt?: string;
  note?: string;
  /** Actual ₪ amount recorded as having changed hands for this branch/month, same sign convention
   *  as netToOwner (positive = partner paid owner, negative = owner paid partner). Lets the owner
   *  log partial or catch-up payments that don't match the computed netToOwner exactly. Older
   *  records that only have `transferred: true` (no amount) are treated as fully settled for
   *  netToOwner - see `lib/branch-ledger.ts`. */
  transferredAmount?: number;
  /** id of the matching n_ah_income doc (type "laptops") auto-created for this branch/month when
   *  transferredAmount is positive (partner/branch paid the owner) - see lib/branch-income-ledger.ts.
   *  Kept in sync (updated/deleted) whenever transferredAmount changes; undefined if the recorded
   *  amount is 0 or negative (owner owes the branch/partner - not owner income). */
  linkedAhIncomeId?: string;
  /** true once a receipt was issued for this branch/month's transfer, owner-marked. */
  receiptIssued?: boolean;
}

// --- חנות AI (עוזר קניה חכם למחשבים בהתאמה אישית) ---

export type ShopUseCase = "torah" | "office" | "graphics" | "video" | "gaming" | "programming" | "general";

export type ShopTier = "minimal" | "recommended" | "extreme";

/** collection: n_shop_catalog - מחשבים אמיתיים למכירה, ממולאים ידנית ע"י הבעלים.
 *  כל עוד לא הוזן פריט תואם, מנוע ההמלצות (`apps/web/lib/shop-recommender.ts`) נופל חזרה
 *  למפרט גנרי לפי תחום/רמת עומס, בלי מחיר סופי. */
export interface ShopComputerConfig {
  id: string;
  name: string;
  tier: ShopTier;
  useCases: ShopUseCase[];
  /** רמת העומס המינימלית (1-5) שהתצורה הזו מכסה בנוחות */
  minLoadLevel: number;
  cpu: string;
  ram: string;
  storage: string;
  gpu?: string;
  extras?: string;
  /** ריק = "יימסר בהצעת מחיר" */
  priceILS?: number;
  notes?: string;
  active: boolean;
}

export type ShopAddonType = "bag" | "mouse" | "keyboard" | "flashdrive" | "other";

/** collection: n_shop_addons - ציוד נלווה שניתן להוסיף להצעת המחיר (תיק, עכבר, מקלדת, דיסק און קי וכד') */
export interface ShopAddon {
  id: string;
  name: string;
  type: ShopAddonType;
  /** ריק = "יימסר בהצעת מחיר" */
  priceILS?: number;
  active: boolean;
}

export type ShopLeadStatus = "new" | "contacted" | "closed";

/** תמצית תצורה מומלצת אחת כפי שהוצגה ללקוח בזמן השיחה - נשמרת קפואה על הליד/בהצעת המחיר
 *  גם אם הקטלוג ישתנה אחר כך */
export interface ShopRecommendedOption {
  tier: ShopTier;
  title: string;
  specsSummary: string;
  reason: string;
  priceILS?: number;
  catalogId?: string;
}

/** collection: n_shop_leads - פניות שהתקבלו מהצ'אטבוט הציבורי (`/shop`) */
export interface ShopLead {
  id: string;
  createdAt: string; // ISO
  useCase: ShopUseCase;
  useCaseLabel: string;
  loadLevel: number;
  description: string;
  answers: { question: string; answer: string }[];
  recommendedOptions: ShopRecommendedOption[];
  selectedTier?: ShopTier;
  selectedAddonNames?: string[];
  contactName?: string;
  contactEmail: string;
  contactPhone: string;
  status: ShopLeadStatus;
  notes?: string;
}

// --- משימות ונהלים (נהלים + סלעים ואבני דרך) ---

/** collection: n_procedures - נהלים ברורים למודול "משימות ונהלים" (עורך עשיר, כמו הדרכות) */
export interface Procedure {
  id: string;
  title: string;
  content: string; // HTML עשיר
  category?: string;
  order?: number;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export type RockStatus = "active" | "done" | "dropped";

/** collection: n_rocks - סלעים רבעוניים ותתי-סלעים (מודל EOS-style, מודול "משימות ונהלים").
 *  `parentRockId` ריק = סלע רבעוני עצמו; מוגדר = תת-סלע תחת סלע קיים (עומק אחד בלבד). */
export interface Rock {
  id: string;
  title: string;
  description?: string;
  /** "2026-Q3" */
  quarterKey: string;
  parentRockId?: string | null;
  ownerUserId?: string;
  ownerName?: string;
  status: RockStatus;
  order?: number;
  createdAt: number;
  createdBy?: string;
}

export type MilestoneStage = "backlog" | "month" | "week";

/** collection: n_milestones - אבני הדרך (המשימות בפועל) תחת סלע/תת-סלע. `quarterKey` מוכפל
 *  מהסלע-אב כדי לאפשר שאילתת שוויון יחידה בתצוגת הרבעון בלי אינדקס מורכב. `monthKey`/`weekKey`
 *  נשארים על הרשומה גם אחרי שהיא קודמה הלאה (לצורך היסטוריה/דפדוף אחורה), ו-`stage` מסמן את
 *  הדלי הפעיל הנוכחי שלה. */
export interface Milestone {
  id: string;
  rockId: string;
  quarterKey: string;
  title: string;
  ownerUserId?: string;
  ownerName?: string;
  stage: MilestoneStage;
  /** "2026-08" - מוגדר כש-stage מגיע ל-"month" ואילך */
  monthKey?: string;
  /** מפתח שבוע פנימי לא-ISO ("W1234"), ניתן להזזה בקלות - מוגדר כש-stage מגיע ל-"week" */
  weekKey?: string;
  done: boolean;
  doneAt?: number;
  /** כמה פעמים הועברה קדימה (לשבוע/חודש הבא) בלי להסתיים */
  carryOverCount?: number;
  order?: number;
  createdAt: number;
  createdBy?: string;
}

export type RockReviewPeriod = "quarterly" | "monthly" | "weekly";

/** collection: n_rock_reviews - סיכום/לקחים לכל פגישת רבעון/חודש/שבוע. מזהה דטרמיניסטי
 *  `${period}_${periodKey}` כך שיש רשומה אחת בלבד לכל תקופה (upsert). */
export interface RockReview {
  id: string;
  period: RockReviewPeriod;
  periodKey: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}
