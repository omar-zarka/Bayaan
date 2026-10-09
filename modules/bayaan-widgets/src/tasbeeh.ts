export interface PendingTasbeeh {
  dhikrId: string;
  count: number;
  day: string; // YYYY-MM-DD local
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function mergeTasbeehIncrements(
  pending: PendingTasbeeh[],
  today: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of pending) {
    if (p.day !== today || p.count <= 0) continue;
    totals[p.dhikrId] = (totals[p.dhikrId] ?? 0) + p.count;
  }
  return totals;
}

function isPendingTasbeeh(value: unknown): value is PendingTasbeeh {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dhikrId' in value &&
    'count' in value &&
    'day' in value &&
    typeof value.dhikrId === 'string' &&
    typeof value.count === 'number' &&
    typeof value.day === 'string'
  );
}

export function parsePendingTasbeeh(json: string): PendingTasbeeh[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isPendingTasbeeh) : [];
}
