import { describe, it, expect } from 'vitest';
import { viewportForWidth } from './viewport';

describe('viewportForWidth (BRD 1.3 section 6.1)', () => {
  it.each([
    [320, 'mobile'],
    [375, 'mobile'],
    [768, 'mobile'],
    [769, 'tablet'],
    [1024, 'tablet'],
    [1025, 'desktop'],
    [1920, 'desktop'],
  ])('%ipx is %s', (width, expected) => {
    expect(viewportForWidth(width)).toBe(expected);
  });
});
