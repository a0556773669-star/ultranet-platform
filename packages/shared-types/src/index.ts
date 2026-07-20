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
  createdByEmail?: string;
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
  createdByEmail?: string;
}

/** collection: n_branch_income (manual/rental/coworking income entries for partner branches) */
export interface BranchIncome {
    id: string;
    branchId: string;
    amount: number;
    desc: string;
    date: string;
    month: string;
    collectionRouteId?: string | null;
    paymentMethod?: string;
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

/** collection: n_ah_income (owner-only manual accounting) */
export interface AccountingIncome {
    id: string;
    amount: number;
    desc: string;
    business: "computers" | "rentals" | "coworking" | "other" | "general";
    type: "fixed" | "variable" | "cash";
    date: string;
    month: string;
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
