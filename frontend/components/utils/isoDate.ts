// Structural checks for a site-local ISO date "YYYY-MM-DD" (BRD 1.2 5.3 Feature 2). A structural check is NOT a business rule: it
// says whether the text is a real calendar date, never whether the date is allowed.
export function isRealIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Date.UTC rolls an impossible date (month 13, day 40) over into a real one, so check that nothing moved.
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** True when `value` lies within the SUPPLIED bounds. Bounds are never derived here. ISO dates compare correctly as strings. */
export function withinBounds(value: string, min?: string, max?: string): boolean {
  if (min && value < min) return false;
  if (max && value > max) return false;
  return true;
}
