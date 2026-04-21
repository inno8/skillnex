/**
 * Min-max normalization with documented edge-case behavior.
 *
 * - Array length 0 → throws.
 * - Array length 1 → returns [50] (single-employee edge case, avoids NaN).
 * - All equal values → returns [50, 50, ...] (everyone is average).
 * - Normal case → maps [min, max] → [0, 100] linearly.
 */
export function normalize(values: number[]): number[] {
  if (values.length === 0) throw new Error("normalize() called with empty array");
  if (values.length === 1) return [50];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);

  const range = max - min;
  return values.map((v) => Math.round(((v - min) / range) * 1000) / 10);
}

/**
 * Return the 0-based index ranking of a value among its peers, descending.
 * Highest value → rank 0 (best). Ties: deterministic by input index order.
 */
export function rankDescending(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => b.v - a.v || a.i - b.i);
  const rankOf = new Array<number>(values.length);
  indexed.forEach((item, rank) => {
    rankOf[item.i] = rank;
  });
  return rankOf;
}
