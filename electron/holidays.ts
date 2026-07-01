import Holidays from 'date-holidays';

// Pure (no DB) so it can be unit-tested. `region` is a country code with an optional state, e.g. "GB-ENG".
let cache: { key: string; hd: Holidays } | null = null;
function getHolidays(region: string): Holidays {
  if (cache?.key === region) return cache.hd;
  const [country, state] = region.split('-');
  const hd = state ? new Holidays(country, state) : new Holidays(country);
  cache = { key: region, hd };
  return hd;
}

export function isPublicHoliday(dateStr: string, region: string): boolean {
  // Noon avoids any timezone rollover to the previous/next day.
  const result = getHolidays(region).isHoliday(new Date(dateStr + 'T12:00:00'));
  return Array.isArray(result) && result.some((h) => h.type === 'public' || h.type === 'bank');
}

const toSortedList = (obj: Record<string, string> | undefined) =>
  Object.entries(obj ?? {})
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

export function listCountries(): { code: string; name: string }[] {
  return toSortedList(new Holidays().getCountries('en') as Record<string, string>);
}

export function listStates(country: string): { code: string; name: string }[] {
  return toSortedList(new Holidays(country).getStates(country, 'en') as Record<string, string> | undefined);
}
