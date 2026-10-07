/** Чистая логика: нет импортов SDK, файловой системы или состояния мира. */
export interface Reservoir {
  readonly stored: number;
  readonly capacity: number;
}

export type Transfer =
  | { readonly ok: true; readonly next: Reservoir }
  | { readonly ok: false; readonly reason: "invalid-amount" | "full" | "empty" };

/** Проверка границы загрузки: сохранение нельзя считать корректным только из-за TS-типа. */
export function restore(stored: number, capacity: number): Reservoir {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 32767) {
    throw new Error("Capacity must be an int16 value between 0 and 32767");
  }
  if (!Number.isInteger(stored) || stored < 0 || stored > capacity) {
    throw new Error("Stored energy is outside reservoir capacity");
  }
  return { stored, capacity };
}

export function transfer(reservoir: Reservoir, amount: number): Transfer {
  if (!Number.isInteger(amount)) return { ok: false, reason: "invalid-amount" };
  const stored = reservoir.stored + amount;
  if (stored > reservoir.capacity) return { ok: false, reason: "full" };
  if (stored < 0) return { ok: false, reason: "empty" };
  return { ok: true, next: { stored, capacity: reservoir.capacity } };
}
