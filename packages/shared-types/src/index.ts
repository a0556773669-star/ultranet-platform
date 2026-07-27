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
}

/** collection: n_users */
export interface AppUser {
    id: string;
    name: string;
    email: string;
    pass: string; // legacy plaintext - replace with proper auth before any customer-facing exposure
  role: UserRole;
    branchId: string; // "all" for owner
  perms?: Partial<Record<"branches" | "computers" | "rentals" | "coworking" | "accounting" | "tasks" | "charging", boolean>>;
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
  stickOnlyDayPrice?: number;
  stickOnlyWeekPrice?: number;
  stickOnlyMonthPrice?: number;
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
    day1: number;
    day2: number;
    day3plus: number;
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
  referralSource?: string; // free text: how the client found us
}

/** collection: n_rentals */
export interface Rental {
  id: string;
  branchId: string;
  clientId: string;
  itemId: string;
  kind: "laptop" | "stick";
  pricingVariant?: "normal" | "noInternet" | "stickOnly";
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
}
