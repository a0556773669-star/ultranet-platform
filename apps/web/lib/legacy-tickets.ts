export type TicketStatus = "open" | "progress" | "done";
export type TicketDirection = "to-admin" | "to-branch";

export type LegacyTicket = {
  branch: string;
  branchKey: string;
  title: string;
  desc: string;
  status: TicketStatus;
  direction: TicketDirection;
  date: string;
  by: string;
  byBranch: string;
  byEmail: string;
};
