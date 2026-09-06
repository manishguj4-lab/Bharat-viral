export function toKeywordList(...values: unknown[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const v = String(item ?? "").trim();
        if (v && !result.includes(v)) result.push(v);
      }
    } else {
      const raw = String(value ?? "").trim();
      if (!raw) continue;
      for (const item of raw.split(/[,|]/g)) {
        const v = item.trim();
        if (v && !result.includes(v)) result.push(v);
      }
    }
  }
  return result.slice(0, 30);
}
