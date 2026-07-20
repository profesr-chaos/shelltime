// Group items into category buckets for display. Order within each bucket is the caller's input
// order, so sort before grouping if you want a particular within-category order. Bucket order:
// with `getWeight`, categories are ranked by descending total weight (e.g. hours worked), ties
// broken alphabetically; without it, plain alphabetical. The uncategorised bucket (null category,
// shown as "Other") always sorts last.
export function groupByCategory<T>(
  items: T[],
  getCategory: (item: T) => string | null,
  getWeight?: (item: T) => number
): { category: string | null; items: T[] }[] {
  const named = [...new Set(items.map(getCategory).filter((c): c is string => !!c))];
  const groups: { category: string | null; items: T[] }[] = named.map((category) => ({
    category,
    items: items.filter((i) => getCategory(i) === category),
  }));
  if (getWeight) {
    const total = (g: { items: T[] }) => g.items.reduce((s, i) => s + getWeight(i), 0);
    groups.sort((a, b) => total(b) - total(a) || a.category!.localeCompare(b.category!));
  } else {
    groups.sort((a, b) => a.category!.localeCompare(b.category!));
  }
  const uncategorised = items.filter((i) => !getCategory(i));
  if (uncategorised.length) groups.push({ category: null, items: uncategorised });
  return groups;
}
