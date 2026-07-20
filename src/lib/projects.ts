// Group items into category buckets for display: named categories alphabetically, uncategorised
// items last under a null bucket ("Other"). Order within each bucket is the caller's input order,
// so sort before grouping if you want a particular within-category order.
export function groupByCategory<T>(items: T[], getCategory: (item: T) => string | null): { category: string | null; items: T[] }[] {
  const named = [...new Set(items.map(getCategory).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
  const groups: { category: string | null; items: T[] }[] = named.map((category) => ({ category, items: items.filter((i) => getCategory(i) === category) }));
  const uncategorised = items.filter((i) => !getCategory(i));
  if (uncategorised.length) groups.push({ category: null, items: uncategorised });
  return groups;
}
