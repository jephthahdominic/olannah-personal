import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Browser hardening (SDD 15.4). Applied to every response.
//
// Content-Security-Policy:
//  - frame-ancestors 'none' (with X-Frame-Options) stops the app, and later the checkpoint, from being framed and
//    clickjacked. object-src 'none', base-uri and form-action 'self' close common injection routes.
//  - connect-src is 'self' for now. Each real upstream origin (context, bus, assistant, telemetry) must be ADDED here
//    when it exists, never replaced with a wildcard.
//  - script-src still needs 'unsafe-inline' because Next.js emits inline bootstrap scripts into static HTML. That is a
//    known weakness. The planned fix is hashed inline scripts (or nonces on a dynamic render). Until then the other
//    directives, a strict no-HTML-injection rule (react/no-danger) and token-only rendering carry the load.
//  - Development additionally needs 'unsafe-eval' for hot reload, so the strict policy is production only.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera is allowed for this origin only (PhotoCapture, later). Everything else is off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS is only meaningful over HTTPS, so it is sent in production (the edge must terminate TLS).
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Do not advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Sign in and sign up pages and everything under them must never be cached by the browser or a proxy.
      { source: "/login", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/signup", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
