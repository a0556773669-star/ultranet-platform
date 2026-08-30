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
/**
 * מחירון ברירת המחדל של סניף השכרות (`n_branches.rentalPricing`).
 * מוגדר פעם אחת לסניף, וכל מחשב/סטיק בסניף יורש ממנו כל מחיר שלא הוזן לו ידנית.
 * 0 = לא הוגדר.
 */
export interface BranchRentalPricing {
  laptop: {
    dayPrice: number;
    weekPrice: number;
    monthPrice: number;
    /** מחירי "בלי סטיק"; 0 = כמו המחיר עם סטיק */
    noInternetDayPrice: number;
    noInternetWeekPrice: number;
    noInternetMonthPrice: number;
  };
  stick: {
    day1: number;
    /** 0 = כמו המחיר היומי השוטף (day3plus) */
    day2: number;
    day3plus: number;
    weekPrice: number;
    monthPrice: number;
  };
}

export interface Branch {
    id: string;
    name: string;
    location?: string;
    phone?: string;
    founded?: string; // ISO date
  /** תאריך פתיחת הסניף (ISO date). כל חישוב הכנסות/הוצאות של הסניף מתחיל מהחודש הזה בלבד -
   *  חודשים שלפניו מוצגים ריקים ולא נסגר עליהם קיזוז מול השותף. כשלא הוגדר, המערכת נופלת
   *  ל-`founded`, ואם גם הוא ריק - לחודש הראשון שיש בו נתון אמיתי בסניף. סניף שאין בו לא תאריך
   *  ולא נתונים נחשב "טרם נפתח" ולא נוצרת לו שום שורת עלות מהתעריפון. */
  openedAt?: string;
  /** "הסניף עדיין לא התחיל לפעול" - סימון ידני שגובר על הכל: גם אם כבר הוזנו לסניף נתונים
   *  (מחשבים, הוצאה בודדת, שורה שנרשמה בטעות), הוא לא נכנס לשום חישוב ואין לו העברה לבעלים,
   *  עד שמורידים את הסימון. נועד לסניף שנפתח על הנייר אבל טרם התחיל לעבוד. */
  notStarted?: boolean;
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
  /** rentals branches only: default price list every laptop/stick in the branch inherits */
  rentalPricing?: BranchRentalPricing;
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
  /** legacy: true אם הוגדרו למחשב מחירי "בלי סטיק". נגזר אוטומטית בשמירה; התמחור עצמו
   *  מסתמך על ערכי `noInternet*` ולא על הדגל הזה. */
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
  /** n_items doc id of the physical machine this catalogue entry stands for (שכבה 2).
   *  Set when the computer was shipped to the branch from a real purchase; that item carries the
   *  real `unitCost`. Unset for computers registered before the asset layer existed - those are
   *  listed as "מחשב בלי רכישה משויכת" on the integrity screen. */
  itemId?: string;
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
    /** n_items doc id of the physical stick this catalogue entry stands for (שכבה 2). */
    itemId?: string;
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

/** How a cost-rate line's quantity is derived for a branch, before any manual override. */
export type CostQtySource = "laptops" | "sticks" | "sims" | "one" | "manual";

/**
 * collection: n_cost_rates - the price list ("תעריפון") behind the per-branch operating-cost
 * breakdown in /dashboard/accounting/overview. One doc per cost category (computer, bag, stick,
 * SIM filtering, advertising, printing...). `owedBy` is the DEFAULT split for the category and
 * can be overridden per branch via n_branch_cost_settings.
 */
export interface CostRate {
  id: string;
  key: string;
  label: string;
  unitCost: number;
  /** "once" = a one-time purchase per unit (equipment), "monthly" = a recurring monthly charge */
  kind: "once" | "monthly";
  owedBy: "owner" | "partner" | "shared";
  qtySource: CostQtySource;
  order?: number;
}

/**
 * collection: n_branch_cost_settings - per-branch override of one cost rate.
 * Deterministic doc id `${branchId}__${rateKey}` so a save is always an upsert.
 * Every field is optional: what's absent falls back to the rate's own value.
 */
export interface BranchCostSetting {
  id: string;
  branchId: string;
  rateKey: string;
  qty?: number;
  unitCost?: number;
  owedBy?: "owner" | "partner" | "shared";
  paidBy?: "owner" | "partner";
  /** false = don't count this category for this branch at all */
  enabled?: boolean;
}

/**
 * collection: n_ad_areas - one advertising campaign shared by every branch in the same city/area
 * (e.g. "קרית ספר"). The owner carries `ownerPct`% of `monthlyCost`; whatever is left is split
 * evenly between the `branchCount` branches of the area, so each branch pays
 * `monthlyCost * (100 - ownerPct) / 100 / branchCount`.
 *
 * The only automatic advertising line a branch can get: the price list (n_cost_rates) no longer
 * carries a flat "פרסום" rate, because the amount changes every month. A branch outside every
 * area - or one that typed its own advertising expense - is charged only what was entered by
 * hand. See apps/web/lib/ad-areas.ts.
 */
export interface AdArea {
  id: string;
  /** the city / area the campaign runs in */
  name: string;
  /** the campaign's full cost per month, before any split */
  monthlyCost: number;
  /** the owner's share of the campaign, in percent (50 = half) */
  ownerPct: number;
  /** how many branches share the rest; falls back to branchIds.length when unset */
  branchCount?: number;
  /** the branches the per-branch share is actually charged to */
  branchIds: string[];
  /** YYYY-MM, inclusive; before it the campaign isn't charged */
  startMonth?: string;
  /** YYYY-MM, inclusive; after it the campaign isn't charged */
  endMonth?: string;
  /** who fronts the cash for the campaign (affects settlement only, not the split) */
  paidBy?: "owner" | "partner";
  note?: string;
}

/**
 * collection: n_multi_branch_expenses
 *
 * הוצאה חד-פעמית אחת שמתחלקת בין כמה סניפים, עם אחוז שהבעלים לוקח על עצמו.
 * Generalises the AdArea split above (see apps/web/lib/ad-areas.ts) from "advertising only,
 * recurring monthly" to "any one-off expense": the owner carries `ownerPct`% of the total and
 * the branches in `branchIds` divide the rest equally between them.
 *
 * Deliberately NOT stored as N separate n_var_expenses rows: `owedBy` can only express
 * owner / partner / 50-50, so a free percentage (e.g. 30% on the owner) has no representation
 * there. Kept as one doc and expanded into a per-branch line at read time
 * (expandExpenseLines, apps/web/lib/branch-accounting-data.ts) - same approach as n_ad_areas.
 */
export interface MultiBranchExpense {
  id: string;
  /** which module's branches this expense belongs to (rentals for now) */
  module: "rentals";
  desc: string;
  category?: string;
  /** the expense's full cost, before any split */
  amount: number;
  /** the owner's share of it, in percent (50 = half). The branches divide the rest equally. */
  ownerPct: number;
  /** the branches the per-branch share is charged to */
  branchIds: string[];
  /** who fronted the cash (affects the settlement direction only, never the split) */
  paidBy?: "owner" | "partner";
  /** ISO date the expense was made */
  date: string;
  /** YYYY-MM the expense is charged in (derived from `date`) */
  month: string;
  /** id of the matching n_ah_expenses doc auto-created for the owner's share, when the owner
   *  is the one who paid. Deleted together with this expense. */
  linkedAhExpenseId?: string;
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
    /** "other" = a free-category manual entry added from /dashboard/accounting/overview */
    type: "fixed" | "variable" | "cash" | "laptops" | "credit" | "other";
    date: string;
    month: string;
    /** set for type "laptops" (rentals branch) and type "cash" (computers branch / till) */
    branchId?: string;
    /** free-text category picked from ACCOUNTING_INCOME_CATEGORIES (apps/web/lib/accounting-categories.ts) */
    category?: string;
}

/** collection: n_ah_expenses */
export interface AccountingExpense {
    id: string;
    amount: number;
    desc: string;
    business: "computers" | "rentals" | "coworking" | "general";
    date: string;
    month: string;
    /** free-text category picked from ACCOUNTING_EXPENSE_CATEGORIES (apps/web/lib/accounting-categories.ts) */
    category?: string;
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
  /** ISO timestamp of when this branch/month's statement was emailed to the branch. Set by the
   *  monthly report run (lib/branch-report-send.ts) and used to skip a month that already went
   *  out, so re-triggering the run never mails the same statement twice. */
  reportSentAt?: string;
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

export type QuarterStatus = "active" | "archived";

/** collection: n_quarters - רבעון עבודה במודל EOS. מזהה המסמך **הוא** ה-`quarterKey`
 *  שמופיע על `Rock`/`Milestone`, כך שנתונים ותיקים עם מפתח לועזי ("2026-Q3") ממשיכים
 *  לעבוד בלי מיגרציה - מסמך רבעון נוצר עבורם בשליפה ראשונה (`ensureQuarter`). רבעון חדש
 *  שנפתח מהמסך מקבל מפתח משלו ותווית חופשית (למשל "ראש חודש אלול - ראש חודש כסלו").
 *  רבעון ב-`status: "archived"` הוא לקריאה בלבד - כל פעולת כתיבה עליו נחסמת בשרת. */
export interface Quarter {
  id: string;
  /** תווית חופשית להצגה, למשל "ראש חודש אלול - ראש חודש כסלו" */
  label: string;
  status: QuarterStatus;
  /** "YYYY-MM-DD" (רשות) - לתצוגה בלבד, לא משמש לחישובים */
  startDate?: string;
  endDate?: string;
  /** מיון ציר הזמן; ככל שגדול יותר - חדש יותר */
  order: number;
  /** החודש ה"פתוח" ברבעון - מה שמוצג בקומת החודש בלוח העבודה. ריק = עוד לא נפתח חודש. */
  activeMonthKey?: string;
  /** השבוע ה"פתוח" ברבעון - מה שמוצג בראש לוח העבודה. ריק = עוד לא נפתח שבוע.
   *  פתיחת שבוע חדש דוחפת את הקודם ל"שבועות קודמים" (הוא נשאר גלוי ברמת החודש/רבעון). */
  activeWeekKey?: string;
  /** הרבעון שממנו גולגל רבעון זה ב-"פתיחת רבעון חדש" */
  rolledFromKey?: string | null;
  createdAt: number;
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
  /** מזהה הסלע/תת-הסלע המקורי שממנו שוכפל בגלגול רבעון (שמירת ההקשר ההיסטורי) */
  rolledFromId?: string | null;
  createdAt: number;
  createdBy?: string;
}

export type MilestoneStage = "backlog" | "month" | "week";

/** מקור אבן הדרך/המשימה: `rock` = נגזרה מסלע (ברירת מחדל, כולל כל הדאטה הישן שאין בו את
 *  השדה), `adhoc` = משימה שבועית/שוטפת שלא קשורה לאף סלע. */
export type MilestoneSource = "rock" | "adhoc";

/** collection: n_milestones - אבני הדרך (המשימות בפועל) תחת סלע/תת-סלע. `quarterKey` מוכפל
 *  מהסלע-אב כדי לאפשר שאילתת שוויון יחידה בתצוגת הרבעון בלי אינדקס מורכב. `monthKey`/`weekKey`
 *  נשארים על הרשומה גם אחרי שהיא קודמה הלאה (לצורך היסטוריה/דפדוף אחורה), ו-`stage` מסמן את
 *  הדלי הפעיל הנוכחי שלה. */
export interface Milestone {
  id: string;
  /** ריק (`""`) כשמדובר במשימה שוטפת (`source: "adhoc"`) שלא תלויה בסלע */
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
  /** ברירת מחדל `"rock"` כשהשדה חסר (כל הדאטה שנוצר לפני מודל המשימות השוטפות) */
  source?: MilestoneSource;
  /** מזהה אבן הדרך המקורית שממנה שוכפלה בגלגול רבעון */
  rolledFromId?: string | null;
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

/* ================================================================== *
 * מודל שלוש השכבות — שכבה 2 (נכסים) ושכבה 1 (תנועות)
 *
 * The three questions the business is asked, each answered by its own layer, so a shekel is
 * recorded once and looked at from as many angles as needed:
 *   שכבה 1 · כסף     — "איפה הכסף שלי עכשיו?"          -> Transaction (n_tx)
 *   שכבה 2 · נכסים   — "מה יש לי, איפה, וכמה זה עלה?"  -> Purchase / Item / ItemMove
 *   שכבה 3 · רווחיות — "כמה הרווחתי, ואיפה?"           -> the branch book (existing collections)
 *
 * The founding rule: buying equipment is NOT an expense, it is a conversion of money into an
 * asset. A capital transaction stops at layer 2 and becomes items; the items carry their cost
 * with them from the warehouse to a branch WITHOUT a single new shekel being recorded. That is
 * why per-branch investment and the owner's cash-out can both be true at once, and why neither
 * can double-count the other.
 * ================================================================== */

/** What a physical unit is. `other` covers anything bought that doesn't fit the four staples. */
export type ItemKind = "laptop" | "stick" | "bag" | "sim" | "other";

/** Where an item currently is: a branch id, or the warehouse sentinel (`"warehouse"`). */
export type ItemLocation = string;

export type ItemStatus = "active" | "repair" | "lost" | "sold" | "writtenoff";

/** Why an item moved. Deliberately has no amount attached anywhere - see ItemMove. */
export type ItemMoveReason = "allocation" | "return" | "transfer" | "repair" | "writeoff" | "initial";

/** One line of a supplier invoice: N units of one kind at one unit price. */
export interface PurchaseLine {
  kind: ItemKind;
  /** free-text name for the line, e.g. "Lenovo T480". Falls back to the kind's Hebrew label. */
  label?: string;
  qty: number;
  unitCost: number;
}

/**
 * collection: n_purchases — the supplier invoice itself (שכבה 2).
 *
 * Invariant enforced on write and re-checked by the integrity screen:
 *   Σ(line.qty × line.unitCost) === total === the linked transaction's amount
 * Creating a purchase creates exactly one capital Transaction and `Σ qty` Item documents; it
 * never creates an expense in any branch's book.
 */
export interface Purchase {
  id: string;
  /** ISO date of the invoice */
  date: string;
  /** YYYY-MM, derived from `date` */
  month: string;
  supplier: string;
  invoiceNo?: string;
  /** the invoice total, in ₪ */
  total: number;
  /** id of the capital n_tx document this purchase created (שכבה 1) */
  txId?: string;
  lines: PurchaseLine[];
  /** link/reference to the scanned invoice, if the owner has one */
  doc?: string;
  note?: string;
  createdAt: number;
}

/**
 * collection: n_items — one physical unit, with its REAL cost and its current location (שכבה 2).
 *
 * `unitCost` is the field the whole model rests on: it is what this specific unit actually cost
 * on its invoice, not a flat price-list estimate (n_cost_rates `kind: "once"`, now retired).
 * Investment in a branch = Σ unitCost of the items whose `location` is that branch - which is
 * why shipping equipment to a branch records no money at all.
 *
 * An item may be linked to the rental catalogue (n_laptops / n_sticks) so the same physical
 * machine isn't described twice: the item is the asset record, the laptop/stick doc is the
 * rental-pricing record.
 */
export interface Item {
  id: string;
  kind: ItemKind;
  label?: string;
  serial?: string;
  /** the invoice this unit came from; empty only for units back-filled without one */
  purchaseId?: string;
  /** what this unit actually cost, in ₪ */
  unitCost: number;
  /** ISO date the unit entered the business */
  acquiredAt: string;
  /** branch id, or WAREHOUSE_LOCATION. Mandatory - an item is in exactly one place (כלל 5). */
  location: ItemLocation;
  status: ItemStatus;
  /** n_laptops doc id this unit is the physical machine for */
  linkedLaptopId?: string;
  /** n_sticks doc id this unit is the physical stick for */
  linkedStickId?: string;
  note?: string;
}

/**
 * collection: n_item_moves — an item went from one place to another, and when.
 *
 * There is no amount field here, on purpose, forever (כלל 2): the cost travels with the item
 * itself, so a move can never create money. A screen that offers a sum field on a shipment is
 * the exact moment double counting is born.
 */
export interface ItemMove {
  id: string;
  itemId: string;
  from: ItemLocation;
  to: ItemLocation;
  /** ISO date */
  date: string;
  reason: ItemMoveReason;
  note?: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ *
 * שכבה 1 — התנועה
 * ------------------------------------------------------------------ */

/**
 * Which layer a movement belongs to. This single field is the whole classification:
 *  - `operating` — real running income/cost. Goes to the branch book, splits with the partner.
 *  - `capital`   — equipment. Stops at the asset layer, NEVER enters a branch's operating book
 *                  and is never split with a partner (כלל 7). It is the owner's own capital.
 *  - `transfer`  — settling a debt (the partner's monthly transfer, a move between the owner's
 *                  own accounts). Neither income nor expense (כלל 8): the income it settles is
 *                  already recorded in the branch's book, so counting it again would duplicate.
 */
export type TxNature = "operating" | "capital" | "transfer";

export type TxDirection = "in" | "out";

/** Which unit of the business a transaction hangs on, in the profit-centre tree (פרק ה׳). */
export type TxBusiness = "rentals" | "computers" | "coworking" | "hq";

/**
 * The node a transaction hangs on. Tag at the LOWEST node actually known: when the branch is
 * unknown, `"shared"` (the business-wide parent node) is a correct answer, not a sloppy one.
 */
export interface TxNode {
  business: TxBusiness;
  /** a branch id, `"shared"` (the whole business unit) or `"hq"` (headquarters/overheads) */
  branchId: string;
}

/** One branch's slice of a transaction. Σ amount over allocations must equal tx.amount (כלל 3). */
export interface TxAllocation {
  branchId: string;
  amount: number;
}

/** A transaction that repeats monthly, expanded into per-month lines at read time. */
export interface TxRecurring {
  /** YYYY-MM, inclusive */
  from: string;
  /** YYYY-MM, inclusive; empty = still running */
  to?: string;
  /** day of month the charge falls on (1-31); display only */
  dayOfMonth?: number;
}

/**
 * collection: n_tx — every shekel that moves, recorded exactly once (שכבה 1, כלל 1).
 *
 * Replaces, as the single write path, what used to be seven separate sources: n_ah_income,
 * n_ah_expenses, n_var_expenses, n_fixed_expenses, n_multi_branch_expenses and n_ad_areas.
 * Existing documents in those collections are NOT migrated - they are projected into this same
 * shape at read time (apps/web/lib/tx-data.ts), the same "filter instead of migrate" technique
 * RETIRED_RATE_KEYS uses. New rows are written here.
 *
 * `amount` is ALWAYS the full sum before any split. `ownerShare` says how much of it is the
 * owner's economically - a plain number rather than an owner/partner/50-50 bucket, so a free
 * percentage (30% on the owner) needs no separate collection to express it.
 */
export interface Transaction {
  id: string;
  /** ISO date the money actually moved */
  date: string;
  /** YYYY-MM, derived from `date` */
  month: string;
  direction: TxDirection;
  /** the full amount, in ₪, before any split */
  amount: number;
  nature: TxNature;
  node: TxNode;
  desc: string;
  category?: string;
  /** who physically paid/received the cash. Affects settlement direction only, never the split. */
  paidBy?: "owner" | "partner";
  /** the owner's economic share of `amount`, in ₪ */
  ownerShare: number;
  /** per-branch split; empty/absent = the whole amount sits on `node`. Σ must equal `amount`. */
  allocations?: TxAllocation[];
  /** set when this row stands for a monthly recurring charge rather than a single dated payment */
  recurring?: TxRecurring | null;
  /** set only when `nature === "capital"` - the invoice this outflow paid for */
  purchaseId?: string;
  /** invoice / receipt reference */
  doc?: string;
  note?: string;
  createdAt: number;
}
