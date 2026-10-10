import { describe, it, expect, afterEach } from 'vitest';
import { formatSiteLocalDate, formatSiteLocalTime } from './formatSiteLocal';

describe('site-local formatting', () => {
  it.each([
    ['00:00', '12:00 AM'],
    ['09:05', '9:05 AM'],
    ['10:30', '10:30 AM'],
    ['12:00', '12:00 PM'],
    ['13:15', '1:15 PM'],
    ['23:59', '11:59 PM'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatSiteLocalTime(input)).toBe(expected.replace(' ', ' '));
  });

  it('formats dates without converting them', () => {
    expect(formatSiteLocalDate('2026-09-21')).toBe('Sep 21');
    expect(formatSiteLocalDate('2026-01-01')).toBe('Jan 1');
    expect(formatSiteLocalDate('2025-12-31', true)).toBe('Dec 31, 2025');
  });

  it('returns invalid input unchanged instead of inventing a value', () => {
    for (const bad of ['', 'noon', '25:00', '10:60', '2026-13-40', '2026-02-30', '21/09/2026']) {
      expect(formatSiteLocalTime(bad)).toBe(bad);
      expect(formatSiteLocalDate(bad)).toBe(bad);
    }
  });

  describe('never shifts with the viewer time zone', () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });
    it.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati'])('stays put under TZ=%s', (tz) => {
      process.env.TZ = tz;
      expect(formatSiteLocalTime('10:30')).toBe('10:30 AM');
      expect(formatSiteLocalDate('2026-09-21')).toBe('Sep 21');
    });
  });
});
