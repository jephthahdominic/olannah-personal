// Site-local formatting (BRD 1.2 5.3 Feature 2). Upstream supplies a wall-clock time or date AT THE SITE. The canvas only
// formats it: it never converts it into the viewer's time zone, because the contracts name site-local semantics
// explicitly. Parsing as UTC and formatting as UTC guarantees the wall-clock digits are preserved on every device.

const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const DATE_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "10:30" becomes "10:30 AM". Returns the input unchanged if it is not HH:MM, rather than inventing a value. */
export function formatSiteLocalTime(hhmm: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return hhmm;
  return TIME.format(new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2]))));
}

/** "2026-09-21" becomes "Sep 21", or "Sep 21, 2026" when `withYear` is set. */
export function formatSiteLocalDate(isoDate: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls an impossible date (month 13, day 40) over into a real one. Reject it instead of inventing a date.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return isoDate;
  return (withYear ? DATE_YEAR : DATE).format(d);
}
