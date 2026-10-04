/** מי רואה שאלה: "owner" = בעלים ומזכירה, "renter" = שותף בסניף השכרות. */
export type HelpAudience = "owner" | "renter";

/** המודול שהשאלה שייכת אליו — לסינון לפי הרשאות המשתמש. */
export type HelpModule =
  | "login"
  | "home"
  | "users"
  | "computers"
  | "rentals"
  | "coworking"
  | "accounting"
  | "duxus"
  | "shop"
  | "tutorials";

export interface HelpFaq {
  id: string;
  audience: HelpAudience;
  module: string;
  question: string;
  tags: string[];
  answer: string;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };
