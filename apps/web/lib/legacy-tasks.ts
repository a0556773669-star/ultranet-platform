export type TaskFreq = "weekly" | "monthly";
export type TaskAssign = "admin" | "branches";

export type LegacyTask = {
  name: string;
  freq: TaskFreq;
  assign: TaskAssign;
  branches: string[];
  done: Record<string, boolean>;
};

export function getWeekKey(date: Date = new Date()): string {
  const s = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = s.getUTCDay() || 7;
  s.setUTCDate(s.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(s.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((s.getTime() - y.getTime()) / 86400000 + 1) / 7);
  return s.getUTCFullYear() + "-W" + week;
}
