/**
 * Tiered rental pricing: always returns the cheapest valid combination of
 * day / week / month rates for a given number of rental days.
 * Example: 5 days at a daily rate of 40 = 200, but if the weekly rate is 180,
 * the result is 180 (never charge more than the next tier's flat price).
 */
export function calcRentalPrice(
  days: number,
  dailyRate: number,
  weeklyRate?: number,
  monthlyRate?: number
): number {
  const daily = dailyRate || 0;
  const weekly = weeklyRate && weeklyRate > 0 ? weeklyRate : undefined;
  const monthly = monthlyRate && monthlyRate > 0 ? monthlyRate : undefined;
  if (days <= 0) return 0;

  const memo = new Map<number, number>();
  function cost(n: number): number {
    if (n <= 0) return 0;
    const cached = memo.get(n);
    if (cached !== undefined) return cached;
    let best = n * daily;
    if (weekly !== undefined) {
      best = n <= 7 ? Math.min(best, weekly) : Math.min(best, weekly + cost(n - 7));
    }
    if (monthly !== undefined) {
      best = n <= 30 ? Math.min(best, monthly) : Math.min(best, monthly + cost(n - 30));
    }
    memo.set(n, best);
    return best;
  }

  return cost(Math.min(days, 3650));
}

export function calcRentalDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const rawDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  let billableDays = 0;
  for (let i = 1; i <= rawDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d.getDay() !== 6) billableDays++;
  }
  return Math.max(1, billableDays);
}

/**
 * Progressive per-day pricing for stick-only rentals: day1 covers the first
 * day, day2 covers the second day, and every day from the third onward is
 * billed at the day3plus rate.
 */
export function calcStickPrice(days: number, day1: number, day2: number, day3plus: number): number {
  if (days <= 0) return 0;
  let total = day1 || 0;
  if (days >= 2) total += day2 || 0;
  if (days > 2) total += (days - 2) * (day3plus || 0);
  return total;
}
