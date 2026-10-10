import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

// The hardening headers are part of the contract (SDD 15.4). If someone removes one, this fails.
async function headersFor(source: string) {
  const rules = await nextConfig.headers!();
  return Object.fromEntries(rules.filter((r) => r.source === source).flatMap((r) => r.headers).map((h) => [h.key, h.value]));
}

describe('security headers', () => {
  it('sends the baseline hardening headers on every path', async () => {
    const h = await headersFor('/:path*');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(h['Permissions-Policy']).toMatch(/microphone=\(\)/);
  });

  it('the CSP forbids framing, plugins, base tag hijacking and cross-origin form posts, and has no wildcard source', async () => {
    const csp = (await headersFor('/:path*'))['Content-Security-Policy'];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/(^|[ ;])\*([ ;]|$)/);
    expect(csp).not.toContain('http:');
  });

  it('never caches the sign in and sign up pages', async () => {
    expect((await headersFor('/login'))['Cache-Control']).toBe('no-store');
    expect((await headersFor('/signup'))['Cache-Control']).toBe('no-store');
  });

  it('does not advertise the framework', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
