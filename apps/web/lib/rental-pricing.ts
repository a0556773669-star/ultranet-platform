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
  return Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
}
