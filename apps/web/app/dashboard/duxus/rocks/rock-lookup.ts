import type { Rock } from "@ultranet/shared-types";

export function buildRocksById(rocks: Rock[]): Map<string, Rock> {
  return new Map(rocks.map((r) => [r.id, r]));
}

export function rockBreadcrumb(rockId: string, rocksById: Map<string, Rock>): string {
  const rock = rocksById.get(rockId);
  if (!rock) return "";
  if (rock.parentRockId) {
    const parent = rocksById.get(rock.parentRockId);
    return parent ? `${parent.title} ‹ ${rock.title}` : rock.title;
  }
  return rock.title;
}
