import type { Rock } from "@ultranet/shared-types";

export function buildRocksById(rocks: Rock[]): Map<string, Rock> {
  return new Map(rocks.map((r) => [r.id, r]));
}

/** נתיב הסלע של אבן דרך לתצוגה. משימה שוטפת (בלי `rockId`) מסומנת ככזו במפורש. */
export function rockBreadcrumb(rockId: string, rocksById: Map<string, Rock>): string {
  if (!rockId) return "משימה שוטפת";
  const rock = rocksById.get(rockId);
  if (!rock) return "";
  if (rock.parentRockId) {
    const parent = rocksById.get(rock.parentRockId);
    return parent ? `${parent.title} ‹ ${rock.title}` : rock.title;
  }
  return rock.title;
}
