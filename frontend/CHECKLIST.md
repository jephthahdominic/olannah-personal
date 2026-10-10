# Olannah Canvas Frontend: Master Build Checklist

Derived from: **1.0** Canvas Shell and Dynamic Layout Engine BRD (V2), **1.2** Component Library, **1.3** Design System BRD (V1), and the **Frontend System Design Document** (SDD v0.1, 3 Oct 2026).

**Not available to me:** BRD **1.1** (Navigation) and **1.4** (Human Checkpoint UI). Both are referenced heavily. Their content below comes second-hand through the other four documents. Get those two files and re-verify sections 11 and 13 before building them.

## Progress (8 Oct 2026)

**152 done · 88 partly done · 127 to do** (of 367 items). Stages 0 to 3 of [DELIVERY_PLAN.md](DELIVERY_PLAN.md) are built (the Stage 3 dev deploy is waiting on your go-ahead), and sign in and sign up were hardened on 8 Oct ([SECURITY.md](SECURITY.md)). Not yet committed or checked in a real browser.

Still blocked on other people: BRDs 1.1 and 1.4, the Figma file (connector not authorized), Design decisions on the focus ring and small-text colors, and Product answers on onboarding, the login screen, and the support contact.

## Legend

- `[ ]` to do · `[x]` done and verified · `[~]` partly done or waiting on a decision (see the note on the line) · priorities follow the BRDs: **P0** first build, **P0.5** estimator-only (built when estimator screens start), **P1** next cycle, **P2** later.
- Source tags: `1.0 UR3` = User Requirement 3, `1.0 SR17` = System Requirement 17, `1.2 §5.8`, `1.3 §7.3`, `SDD §11`, `ADR-005`.
- **[NEW]** = not in the BRDs. It exists because you told us auth and onboarding are coming for both personas.

## Design alignment (decided 8 Oct 2026)

The BRDs and the SDD govern behavior and contracts. The Figma designs (screenshots in `ai-contexts/ui`) govern look, layout, icons and copy tone wherever they do not contradict the BRDs. On a conflict the BRD wins. The full conflict-by-conflict outcome is in [DESIGN_REVIEW.md](DESIGN_REVIEW.md) section 6. Practical consequences for this checklist:

- Navigation stays on the BRD sets (Dashboard / Work Orders / Assets / More; Dashboard / Quotes / Field Review / Settings) on Evergreen Dark. No Scan, Notes, Approvals, Customers or notification bell.
- Chart components, HealthBadge and DatePicker are **deferred** (no approved screen uses them). Ignore the charts chunk in sections 5 and 11.
- Checkpoint follows the BRD rules; the design supplies the visual layout.
- Tint/text colors from the designs are tracked as **proposed** tokens (`tokens.json`, group `proposed`) pending a 1.3 update.
- Worker identity (`displayName`, `initials`, `jobTitle`) is part of the context contract.

## Context in one paragraph

The canvas is a **render-only** shell. It receives a session confirmation, then a context object, assembles a persona layout from shared components, stays fresh through events, and shows a human checkpoint when a write needs approval. It never authenticates, authorizes, fetches from source systems, derives business values, maps error codes, or writes. The 12-week plan has the **technician (mobile) at Week 9** and the **estimator (desktop) at Week 12**, both from one codebase. The backend is not ready, so everything upstream is mocked behind the contracts.

---

## 0. Decisions to make before writing code

- [x] **Framework: Next.js 16 (App Router), decided.** The SDD proposes Vite (ADR-001/002); we are **not** using it. Adapt the SDD's intent to Next.js:
  - [x] Treat the canvas as a **client-rendered app**: no server components or route handlers that fetch from upstream or touch session data; all runtime clients run in the browser (BRD: canvas never fetches from source systems, state is memory-only).
  - [~] Decide static export (`output: 'export'`) vs running the Next server. The SDD's rationale (no SSR tier to operate, CDN-served hashed assets) favors export, but the existing Dockerfile and compose setup currently run the Next server. Confirm with the team. *(partly done: decision pending: still `output: standalone` (Next server). Revisit before production.)*
  - [~] The 100ms loading-screen requirement (1.0 UR1) must hold under Next: the loading screen markup and critical CSS must be in the initial HTML (root layout/server-rendered shell, no client JS needed to paint it) and be **replaced**, not hidden, when the app mounts. *(partly done: markup is in the prerendered HTML; the 100ms timing is not yet measured.)*
  - [~] Map the SDD's Vite-specific items: code splitting via `next/dynamic` and route/persona chunks; bundle budgets via Next's build output or `@next/bundle-analyzer`; `runtime-config.json` served from `public/`; fonts self-hosted via `next/font/local` (not Google fonts, not Geist). *(partly done: fonts via next/font/local and runtime-config in public/ done. next/dynamic persona chunks and bundle analysis not yet.)*
  - [x] Router: use the App Router, with the destination identifier carried in the URL path (ADR-010). Do not let route files contain role logic.
  - [x] Auth screens and the canvas live in separate route groups, e.g. `(auth)` and `(canvas)`.
- [x] **Repo structure.** The SDD proposes a pnpm monorepo (`tokens`, `contracts`, `components`, `clients`, `canvas-runtime`, `canvas-render`, `apps/canvas`, `tools`) with enforced import boundaries (ADR-007). The repo is currently a single npm package. Decide: full monorepo now, or a single package with folder boundaries enforced by lint (cheaper, same rules).
- [ ] Ratify or amend ADR-001 to ADR-012 in one review (SDD Appendix F).
- [~] **Resolve token naming conflict:** `--color-semantic-blocking` (1.3 §3.3 table) vs `--color-semantic-checkpoint` (1.3 §3.4, §9.3). Both are Moss Gold. Choose one authoritative name before any component is built (SDD Q32, R9). *(partly done: `checkpoint` is authoritative, `blocking` kept as alias. Design to confirm.)*
- [~] **Resolve the AAA contrast target:** 1.3 §11.1 requires 7:1 for checkpoint text on a Moss Gold surface. The SDD calculates neither dark text (~5.5:1) nor white (~3.2:1) reaches that on `#B38A45`. Run the contrast gate on real values and let Design decide (likely: checkpoint text surfaces avoid Moss Gold fills). The target is P1, so it does not block P0. *(partly done: gate reports 5.51:1 and 3.16:1. Design to decide.)*
- [~] **Toast vs checkpoint layering:** toast is z-500 and checkpoint is z-700, but toasts must not obscure checkpoint content. Adopt the SDD §11.8 proposal (hold toasts until dismissal; checkpoint-scoped messages render inside the surface) and get Design to confirm. *(partly done: toast host is at z-500. Holding toasts during a checkpoint arrives with the checkpoint.)*
- [x] **Define the topbar.** 1.3 references a topbar (feedback link, Evergreen fill) but no zone or component defines it (SDD R20, Q30).
- [~] **Canvas-wide focus fallback** when the previously focused element is gone: adopt the primary-content-zone heading until decided (Q27). *(partly done: `useFocusReturn` takes a fallback, but the shell does not pass one yet.)*
- [x] Confirm with Product the consequence of ADR-010: **memory-only state**, so drafts and scroll are lost on hard reload.
- [~] Confirm Product's **hard-timeout value** for context delivery (SDD proposes 10,000ms, Q26) and the **loading-message switch interval** (proposed 3,000ms). *(partly done: defaults 800ms / 10,000ms / 3,000ms live in runtime config. Product to confirm.)*
- [~] Confirm the dev stack choices that are only proposals: React state store, CSS Modules, schema library (Zod/Valibot), Vitest, Storybook with axe, Playwright, dependency-cruiser. *(partly done: React + external stores, CSS Modules, zod, Vitest, axe-core chosen. Storybook, Playwright, dependency-cruiser not adopted.)*

---

## 1. Project foundation and tooling

- [x] TypeScript **strict mode**, no implicit any (1.2 Assumption 10).
- [ ] Browser support floor **Safari 15, Chrome 100, Firefox 100**; no IE. Set the build target and browserslist to match (1.3 Assumption 9).
- [~] ESLint with custom rules, Stylelint, dependency-cruiser (or equivalent boundary lint) wired into CI. *(partly done: ESLint boundary rules + custom style script in CI. No dependency-cruiser or Stylelint.)*
- [~] **Enforced rules** (SDD §9.3). Each becomes a lint rule, not a review comment: *(partly done: see items below.)*
  - [x] Only the clients layer may reference `fetch`, `XMLHttpRequest`, `EventSource`, `WebSocket`, `sendBeacon`; the render path cannot import clients.
  - [x] No hard-coded colors, lengths, font names, z-index, or motion values (Stylelint + ESLint inline-style rule).
  - [x] No new tokens outside the token package; unknown `var(--x)` fails the build.
  - [ ] No outer margin on a component's root class.
  - [x] Navigation package bans `resolved_role` and role names.
  - [ ] Canvas and navigation ban imports of any permissions module.
  - [ ] Ban lookup tables keyed by error code in component code.
  - [ ] Overlay component is **not exported** from the library index; only the checkpoint controller imports it.
  - [~] No spinner components or loader class names. *(partly done: no spinner component exists. No lint on loader class names yet.)*
  - [~] Icons imported only through one wrapper that whitelists Tabler outline glyphs. *(partly done: Icon wrapper whitelists glyphs. No lint forces all icons through it.)*
  - [x] Ban `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` except one exempt module.
  - [x] Ban `dangerouslySetInnerHTML`.
- [x] Remove create-next-app leftovers (Geist font, default page, Vercel SVGs). The BRD requires self-hosted Inter and Inter Tight.
- [~] Frozen-lockfile installs, pinned versions, vulnerability scanning, SBOM per release (SDD §15.4, §18.1). *(partly done: `npm ci` in CI. No vulnerability scan or SBOM yet.)*
- [~] CI pipeline in this order (SDD §18.1): install, tokens and contrast gate, typecheck, lint, unit/component/contract tests, build and bundle budgets, Storybook state-matrix and axe, integration vs mock upstream, e2e and performance, publish artifacts and zone-checklist. *(partly done: tokens, contrast, styles, lint, typecheck, test, build run. Storybook, integration and e2e stages missing.)*
- [ ] Polyfills for the browser floor: `inert` (ADR-008), `:focus-visible` for Safari < 15.4. Avoid container queries, `@property`, CSS nesting, `:has()` for layout, `dvh`, `structuredClone`, `Array.prototype.at`, `AbortSignal.timeout` (SDD §4.3). Verify the support dates there against current compatibility data.
- [x] Runtime config file (`runtime-config.json`), schema-validated at boot with compiled-in defaults, never secrets; a missing or invalid file logs an event and falls back (ADR-012; keys in SDD Appendix D).

---

## 2. Design tokens (1.3 §3 to §5, §7.3, §9, §10)

Source of truth is a JSON file that generates CSS custom properties and TypeScript token-name types (ADR-005). Components only reference tokens; local tokens are forbidden (1.3 §13.3).

**Colors**
- [x] Brand: `--color-brand-primary` #345241 (hover #3D6050, pressed #2A4035) · `--color-brand-accent` #B38A45 (hover #C49A52) · `--color-brand-secondary` #6A675F.
- [x] Surface: workspace #F7F5F0 · card #FFFFFF · panel #EEF1EB · chrome #2C4438 · overlay rgba(26,26,24,0.55).
- [x] Semantic: success #3A7D44 · warning #B87333 · error #C0392B · blocking/checkpoint #B38A45 (name per section 0).
- [x] Viz palette: viz-1 #345241, viz-2 #B38A45, viz-3 #5B7FA6, viz-4 #8A7A64, viz-5 #4A7A8A.
- [x] Text colors: Warm Cream on Evergreen surfaces, `#1A1A18` primary and Warm Slate secondary on light surfaces. **No pure black or white text anywhere.**
- [~] Warm Slate is **never** used for text or icons on Evergreen or Evergreen Dark. *(partly done: values follow the rule. No automated check.)*
- [~] Brand and semantic layers never cross (brand never means success/warning/error; semantic never decorative). *(partly done: followed in components. No automated check.)*
- [x] Hover is one step lighter, pressed one step darker, for every interactive color.
- [x] Reserve `--dark-*` mirror tokens for every light token with **no values** (dark mode is P2).
- [x] Token names describe purpose, not appearance; shipped names never change (breaking-change rule).

**Type** (self-hosted Inter and Inter Tight, woff2 subset, `font-display: swap`, fallback `system-ui, sans-serif`, declared before any component renders)
- [x] Tokens: display 28/36/600 · heading-lg 20/28/600 · heading-md 16/24/600 · heading-sm 14/20/600 (Inter Tight) · body 14/22/400 · body-sm 13/20/400 · label 11/16/600 uppercase · data 13/18/500 · caption 11/16/400 · nav-label 11/14, 500 inactive and 600 active, never uppercase, no letter-spacing.
- [x] Labels uppercase with 0.06 to 0.08em tracking. Data values medium weight, not bold.
- [x] Hard limits: nothing under 11px, body and data never under 13px, headings never over 28px.
- [x] Emit sizes in **rem** so 200% zoom and OS text scaling work (ADR-005).

**Spacing, layout, layering**
- [x] `--space-1,2,3,4,5,6,8,10,12` (4 to 48px). No value outside the scale.
- [x] `--width-content-max` 720px, `--width-panel` 240px.
- [x] Z-index tokens: base 0, card 10, dropdown 100, command 150, tooltip 200, more-menu 250, drawer 300, modal 400, toast 500, onboarding 600, checkpoint 700. One portal host per layer; components never set a z-index.
- [~] Icon size tokens: xs 14, sm 16, md 20, lg 24, xl 32. `--icon-nav-unavailable` token (wifi-off). *(partly done: sizes done. No `--icon-nav-unavailable` token (wifi-off used via Icon).)*
- [x] Motion tokens (section 4).
- [~] **Contrast gate** in CI computing every declared pairing against 1.3 §11.1 (body text on cream, white and Sage ≥ 4.5:1; large text ≥ 3:1; primary button text ≥ 4.5:1; status indicator ≥ 3:1; focus outline ≥ 3:1; Warm Cream on Evergreen Dark ≈ 9.6:1; Moss Gold indicator on Evergreen Dark ≈ 3.3:1 vs 3:1 required). Report actual ratios. *(partly done: running in CI with three known issues awaiting Design (focus ring on cream and Sage, text uses of base amber/gold/green).)*
- [ ] Generated token reference published with Storybook; deprecation comments and one-build-cycle retention process (1.3 §13.4).
- [ ] Token changes recorded in the design doc before code (1.3 §13.2).

---

## 3. Global styling, responsive and interaction rules

- [x] **Breakpoints:** mobile ≤ 768, tablet 769 to 1024, desktop ≥ 1025. Mobile-first; media queries only.
- [x] One viewport hook so rail, tab bar and More menu cannot disagree.
- [x] **Three persistent zones**, fixed surface per zone (zone independence):
  - [x] Navigation zone: Evergreen Dark, never changes.
  - [x] Primary content zone: White, **border not shadow**.
  - [x] Context zone: Sage Mist, fixed side rail on tablet/desktop, expandable labelled section on mobile (first thing to collapse).
- [x] **No shadows or elevation anywhere.**
- [ ] Primary card (title, core info, approve/reject/escalate) is always fully visible on every breakpoint, never behind a menu, scroll or second tap.
- [ ] Multi-column field layouts collapse to one column on mobile.
- [ ] Long lists use **progressive load on scroll**, never pagination.
- [~] **Touch targets ≥ 44×44px at every breakpoint including desktop**, using invisible padding where the visual is smaller. *(partly done: Button, NavItem, inputs, toast close are 44px. No global size audit yet.)*
- [~] Logical CSS properties only (`margin-inline-start`, etc.) so RTL stays possible; directional icons flagged for future mirroring. RTL itself is P1 to evaluate. *(partly done: logical properties used except the aside padding. Directional icons not yet flagged.)*
- [ ] Renders at **375px** with no horizontal scroll and no layout break (1.0 UR14).
- [~] **Six interaction states** on every interactive element: default, hover, pressed (scale 0.97), focus (2px offset Moss Gold outline, keyboard-only, never suppressed), disabled (40% opacity, stays visible, no pointer cursor), processing. *(partly done: Button, NavItem and inputs cover them. Not every control yet.)*
- [x] Hover/pressed only on genuinely interactive containers, not their child labels or values.
- [x] **Processing:** controls stay in place, show inline progress, ignore repeat activation, keep label context. Data-bearing content shows Skeleton. The two treatments are never swapped.
- [x] **Skeleton spec** (fill = panel token): title 60%×16, body 90%×12, short body 50%×12, field label 40%×10, field value 70%×13, data value 30%×13, icon circle 20, avatar circle 28, action button 100%×36 **no shimmer**, context row 100%×24, card container **no shimmer**. One shared left-to-right shimmer, stops under reduced motion.
- [~] **Motion:** appearance 150ms ease-out · dismissal 120ms ease-in · hover/focus 80ms ease · panel expand/collapse 200ms ease-in-out · skeleton→content 180ms ease-out · checkpoint appearance 200ms ease-out. **Nothing exceeds 200ms.** No bounce, spring or overshoot. Transitions use opacity and transform only. *(partly done: tokens defined and used for state transitions. Appear/dismiss animations not yet built.)*
- [x] **Reduced motion:** every transition becomes an instant 150ms opacity fade, no spatial movement, shimmer stops. Single `useReducedMotion` source.
- [x] Status indicators: success = filled circle + check, warning = filled triangle + `!`, error = filled circle + cross, checkpoint = **outlined** circle + `!`, inactive = filled circle, loading = animated partial ring. Color is never the only carrier.
- [x] Icons: **Tabler outline only**, inherit color, tree-shaken SVG components (no icon font), informative icons get `aria-label`, decorative ones `aria-hidden`. Never decorative-only.
- [ ] Charts: max 5 series, centered value on donuts and rings, text alternative beside every chart, viz-3 and viz-5 never adjacent, semantic colors never used as series colors, empty state explains why.
- [x] Print stylesheet is out of scope. Dark mode values are out of scope.

---

## 4. Contracts and the mock backend [NEW emphasis: backend is not ready]

The SDD assumes every upstream contract is OPEN. Build against drafts so nothing waits.

- [x] Contracts package/folder with a schema per contract that yields both types and runtime validators (ADR-006), each with a `SUPPORTED_VERSIONS` allow-list. Unknown versions are unsupported, never guessed.
- [~] Draft types from SDD Appendix C, all marked **draft**: `SessionConfirmation`, `ContextEnvelope`, `LayoutConfig`, `BusEvent`, `CheckpointTrigger`, `DiffPayload`, `DecisionEvent`, `AuditStub`, `TerminalOutcome`, `WidgetPayload`, plus `RevocationSignal`, `AssistantFrame`, `HistoryPayload`, `UpstreamChange`, `ValidationResult`. *(partly done: session, context, layout config, bus event, zone payload, dashboard and context data, history, runtime config drafted. Checkpoint, widget, assistant types not yet.)*
- [~] Fixtures per contract: **valid, unknown-version, malformed** (SDD §8.3). *(partly done: context has valid, unknown-version and malformed fixtures. Others pending.)*
- [~] **Mock upstream server** replaying fixtures over SSE, WebSocket and HTTPS, including: *(partly done: built as in-browser mock adapters. Session, context, bus (SSE-style source with heartbeats, drops, failures) and history done. Widget, checkpoint, revocation, assistant not yet.)*
  - [~] Session confirmation for technician, estimator, multi-role, unmapped role, undetermined role, and a second fictional tenant. *(partly done: technician, estimator, multi-role, unmapped, undetermined done. Second fictional tenant not yet.)*
  - [x] Context object delivery with configurable delay (so 800ms, 900ms and never can be simulated).
  - [~] Bus events per zone, heartbeats, drops, resumable IDs (and a flag for out-of-order and duplicate events). *(partly done: zone events, heartbeats, drops and failing reconnects done. Out-of-order/duplicate flag is covered by tests, not by a mock switch. Resumable IDs offered but unhonoured.)*
  - [x] History delivery in a subsequent pass, plus request-more. *(paged delivery with request-more, plus ok, slow, error, empty, degraded and invalid modes.)*
  - [ ] Widget payloads: valid, unknown type, unsupported version, invalid, supplied-degraded.
  - [ ] Checkpoint trigger, diff, upstream-change, validation result, and all 12 terminal-state paths; bus acknowledgments and failures.
  - [~] Access revocation signal, session expiry. *(partly done: session expiry done. Revocation signal not yet.)*
  - [ ] Assistant WebSocket frames including proactive messages.
  - [~] Auth and onboarding endpoints (sections 6 and 7). *(partly done: auth done. Onboarding endpoints not yet.)*
- [~] **Fault-injection layer** reachable from dev builds and Playwright for every row of the error taxonomy (section 14). Compiled out of production and verified by a bundle check. *(partly done: a dev overlay (mock mode only) drives live updates, malformed and unknown payloads, connection drops and failed reconnects, slow/failing refresh and every history mode. Revocation, checkpoint and widget faults pending.)*
- [ ] Contract register (SDD §8.1, K1 to K17) kept current and reviewed weekly until open items close.
- [ ] Breaking schema changes need five business days' notice (governance rule, 1.0 SR20).
- [ ] Contract gate **before Week 3**: checkpoint trigger (K7), diff payload (K8), context transport (K2), bus format (K3) agreed in writing, even if "agreed" means the team's own frozen draft.

---

## 5. Application bootstrap, session and runtime lifecycle

Boot is an explicit state machine; every state has exactly one rendering outcome.

- [~] The initial HTML document (Next root layout) paints the loading screen **within 100ms of page load** with no JavaScript: wordmark, plain message, progress indicator. Critical CSS inlined from the token build, never hand-copied. No nav, no zone scaffolding, no workspace content. *(partly done: loading screen is in the prerendered HTML; the 100ms timing is not yet measured.)*
- [x] Loading screen is **replaced**, not hidden, on mount (a stalled boot never leaves a blank page).
- [ ] Short cache on the HTML document; content-hashed assets with long lifetimes.
- [x] States: `awaitingSession` → `awaitingContext` → `contextDegraded` (after 800ms) → `contextHardTimeout`; `resolving` → `assembled` → `settled`; `fallbackUnknownRole`, `fallbackSchema`, `fallbackMalformed`, `sessionExpired`.
- [x] If session confirmation never arrives: loading screen stays, session doesn't end, no crash; after configured interval the message changes to "taking longer than expected" and `session.slow` is logged.
- [~] On session confirmation (T0): render universal nav items plus role-item skeletons; prefetch the persona chunk if `resolved_role` is in the payload. *(partly done: follows BRD error row 1 (no nav while loading). Persona chunk prefetch not built.)*
- [x] Context delivery slower than 800ms: recoverable loading state with message, session continues, structured event, retry via the context channel (re-delivery request, **never a direct PCR call**).
- [x] Hard timeout: workspace recovery screen (wordmark, plain message, **retry + contact support**, no content/nav/zones); event recorded; no crash.
- [x] **Validate and deep-freeze** the context object at ingestion; type as `DeepReadonly`. Test: hash before and after full boot and several refreshes is identical (1.0 SR16C).
- [x] New session lands on **Dashboard**; a reload returns to the same destination via the **URL path** (ADR-010).
- [ ] Reload vs fresh login distinction needs a non-secret session identifier (OPEN Q2). Build the comparison behind an interface.
- [~] Single `purgeSession()` is the only session-end path: close bus and WebSocket, cancel timers, clear zone store, context, telemetry buffer (after a final flush), persistence manager; drop in-memory token; revoke object URLs; render session-expired screen from foundation components only; redirect to SSO. If a checkpoint is active, move it to *session abandoned* and attempt its audit stub first. *(partly done: registry in place with handlers for controller, telemetry, nav memory, zones, toasts, live regions. Bus and WebSocket arrive later.)*
- [x] Session expired screen: wordmark, "session has ended" message, "unsaved work may need re-entering" note, log-in fallback action. **No data from the expired session survives in the browser.**
- [x] Session token held in memory only, never in URL, storage or logs; one `SessionClient` attaches it to runtime-client requests and never exposes it to the render path.
- [ ] Persona-level code splitting: core chunk (shell, runtime, foundation components, fallback screens, default layout), one chunk per persona layout, a checkpoint chunk preloaded at `settled`, a charts chunk for P0.5 visualizations. Fallback screens and foundation components must render even if every other chunk fails.
- [ ] Atomic deploys; version-skew handling (old tab, new schema → safe fallback; idle reload prompt, **never during a checkpoint**).

---

## 6. Authentication [NEW: both personas; backend not ready]

The BRDs say the shell does **not** authenticate. The SSO flow delivers a session confirmation event, and everything before that is outside the canvas. You've said real auth exists for both personas, so build the entry flow around the same boundary.

**Boundary rules**
- [x] Auth screens live **outside the canvas shell**; the shell renders nothing until a valid `SessionConfirmation` arrives (1.0 UR1, error row 1).
- [x] No auth, role or permission logic in shell or components. A `SessionClient` receives the confirmation and attaches the session; that's all.
- [x] Auth screens obey the design system (tokens, Inter, 44px targets, focus ring, labels, reduced motion, WCAG AA) even though they aren't zones. *(axe is clean on sign in and sign up, pristine and with errors.)*
- [x] **Mock-first:** auth provider hidden behind an interface so the real SSO swaps in with no screen changes. Mock provider returns the technician and estimator fixtures.

**Screens and flows (both personas)**
- [x] Login screen: explicit visible labels (never placeholder-only), plain-language errors with no codes or service names, visible focus, works at 375px and at 200% zoom.
- [x] Sign-in progress state (processing control keeps its place, ignores repeat activation).
- [~] Wrong credentials, locked account, network-down, service-unavailable: each with a plain message and a recovery action (retry or contact support). *(partly done: each failure has a plain message. No contact-support action on the login screen.)*
- [ ] Forgot/reset-password entry point (confirm with Product whether SSO makes this out of scope).
- [x] Session-expired and logged-out landing, consistent with the canvas session-expired screen.
- [x] Post-login handoff: session confirmed → loading screen → canvas boot (T0 starts at confirmation).
- [x] Logout action (Settings) calling `purgeSession()`.
- [x] Multi-role handling: the **primary** role determines layout; never a hybrid (1.0 UR3B). Do not build a role-picker unless Product asks.
- [x] Route guarding is a UX convenience only. The canvas is not an authorization boundary (1.0 SR23C).
- [x] Tab behavior with memory-only token: reload re-enters SSO and shows no flash of workspace.
- [x] Credentials never stored or logged. Test feeds credential-shaped strings through the app and scans emitted logs (1.0 SR23B). *(unit tests scan telemetry, DOM, URL and browser storage after sign in and sign up. An end-to-end browser scan is still to do.)*
- [ ] Persona rollout flag (`personas.enabled = technician`) so estimator ships dark until Week 12.

**Signup and form security [NEW, added 8 Oct]** (full model in [SECURITY.md](SECURITY.md))
- [x] Signup screen (full name, work email, password, confirmation) behind the swappable `AuthProvider`. **Product to confirm that self-signup exists** (not in any BRD).
- [x] **zod** schemas for sign in and sign up with stable error codes, mapped to plain-language messages; unknown fields stripped; values never echoed in errors.
- [x] Password policy: 12 to 128 chars, common-password deny-list, no email-derived passwords, confirmation match. Sign in does not apply the policy.
- [x] **Click and disable**: synchronous submit lock plus busy/inert button and disabled inputs; a burst of submits sends one request; held after success until navigation.
- [x] Client attempt throttle with escalating cooldown and live countdown (validation failures excluded). Advisory only.
- [x] No account enumeration on sign in or sign up (identical messages; sign up confirmation identical for new and existing addresses).
- [x] Password manager friendly attributes, paste never blocked, show/hide password with `aria-pressed`.
- [x] First invalid field focused on a failed validation; errors tied to fields; failures announced.
- [x] Password cleared after failure and success; no secrets in telemetry, DOM, URL or browser storage (tested).
- [x] No open redirect: post-login destination is the constant `/`.
- [x] Mock server re-validates sign up (proves a bypassed form is still rejected).
- [x] HTTP hardening headers verified on the running production server (CSP, frame-ancestors, nosniff, referrer, permissions, COOP/CORP, HSTS, no-store on auth pages, no X-Powered-By).
- [ ] Terms/consent checkbox (needs a Checkbox component).
- [ ] Password reset / forgot password, MFA, "remember me" (not specified).
- [ ] Remove `'unsafe-inline'` from `script-src` using hashes or nonces.
- [ ] Add each real upstream origin to CSP `connect-src` as it appears.
- [ ] Backend enforcement list in SECURITY.md agreed with Identity and Access (rate limit, breached-password check, email verification, session cookies, CSRF).
- [ ] Contact-support link on the auth screens.


**Open for Identity and Access** (1.0 OQ1/OQ2/OQ11/OQ12): role location in the handoff, exact session payload (and a non-secret session ID), revocation signal format, confirmation that Dashboard is permitted for every authenticated worker.

---

## 7. Onboarding [NEW: both personas; spec does not exist]

1.0 UR2 explicitly says **first-time onboarding is a separate product spec** and applies only to returning workers. 1.3 reserves `--z-onboarding` (600) for "first-run experiences and guided feature tours". There's no BRD, so this section is a proposal that **needs a spec from Product before build.**

- [ ] Get or write a short onboarding spec: who counts as first-time, what is shown, whether it can be skipped, whether completion is stored upstream. Memory-only state means completion **cannot** be stored in the frontend (non-goal 10); it must come from upstream, for example via the context object.
- [ ] Decide how the shell learns "first run" (a flag in the context object or session payload) and add it to the contracts. The shell may not infer it.
- [ ] Onboarding renders **after** session confirmation and context delivery (or as a distinct pre-canvas step if Product wants account setup first). Define which.
- [x] Layer: onboarding sits at z-600, **below the checkpoint (700)**; a checkpoint must always preempt it.
- [ ] **Technician (mobile) onboarding:** one-handed, short, 375px. Orients on bottom tab bar (Dashboard, Work Orders, Assets, More), the More menu (Ask Olannah, Feedback, Settings), checkpoint approve/reject behavior, and the offline/degraded indicators.
- [ ] **Estimator (desktop) onboarding:** rail (Dashboard, Quotes, Field Review, Settings), context panel, floating AI assistant trigger, topbar feedback link, checkpoint.
- [ ] Guided-tour mechanics: focus trap and return, Esc handling, skip action, replay from Settings, no motion beyond the 200ms ceiling, reduced motion honored, screen-reader friendly steps.
- [ ] Any account-setup steps (profile, permissions prompts such as camera for PhotoCapture or notifications) as plain-language steps with a recovery path if a permission is denied.
- [ ] Onboarding copy is supplied through the message catalogue (content standard still OPEN, Q24).
- [ ] Mock server flag to toggle first-run for each persona. Playwright scenarios for first-run vs returning, for both personas.
- [ ] Onboarding never obscures an active checkpoint, toast, or critical connection warning.

---

## 8. Layout engine, zones and rendering (1.0 §5, SDD §6)

- [x] **Layout template is data, not code**: `id`, `schemaVersion`, `zones[]`, per-breakpoint placements. Adding a persona adds a template, not shell logic (1.0 SR19).
- [x] `ZoneSpec.unavailable` is **required** in the type, so a zone with no unavailable message cannot compile ("not shippable", 1.0 UR5A). Still generate a per-release zone checklist as evidence.
- [~] Layout resolution as a pure function of the validated context and template registry: *(partly done: all rows except the mid-session degraded layout swap are done.)*
  - [x] Recognized schema + role + mapped layout → load template.
  - [x] Role known, **unmapped** → platform default layout from PCR, universal nav only, structured event, **not** the fallback screen.
  - [x] Role **undetermined** → fallback screen, no template.
  - [x] Multi-role → primary role's layout only.
  - [x] Unrecognized schema → recovery screen + version-mismatch event.
  - [x] Malformed global envelope → recovery screen + event.
  - [x] Malformed zone payload → that zone unavailable only + event.
  - [~] `layout_config` in `degraded_fields` → platform default at start; last good layout mid-session. *(partly done: navigation keeps the last good set. The layout template itself is not swapped.)*
- [x] **Zone host** wraps each zone: error boundary (fallback built from foundation components only), suspense boundary with skeleton, store-slice selector subscription, render-time probe.
- [~] Zones load, fail and refresh **independently** (1.0 UR4): slow zone doesn't delay others, failing zone doesn't affect others. *(partly done: failure isolation tested. Slow-zone independence not yet exercised.)*
- [~] Zone lifecycle machine: scaffolded → rendered / empty / stale / unavailable, with refresh and connection as separate dimensions (a zone can be stale **and** refreshing). *(partly done: conditions exist. Stale/refreshing wiring arrives with the update pipeline.)*
- [x] Component registry maps canonical names to implementations; build fails if a template names an unregistered component.
- [x] Composing layer owns between-component spacing from the scale; components own internal spacing only; components inherit zone Surface background.
- [ ] No client-specific logic in the shell. Test: a second fictional tenant renders with no code change (1.0 SR18).
- [ ] CI check flags any change under the runtime package in a persona-only PR.
- [ ] Context ID check: a component receives a context identifier and refuses to render if it doesn't match the active one (1.2 OQ2 component-side rule).
- [ ] Critical information (active approval, connection failure, blocking states) stays visible and unobscured during any refresh (1.0 UR12).

---

## 9. State, data flow, refresh and persistence (1.0 SR16/17, SDD §7)

- [~] **Only two state categories** in the runtime: render/orchestration and temporary interaction/draft. Enforce with a store type constraint and lint. *(partly done: followed by design. No store-type lint yet.)*
- [ ] Authoritative data (context, history, widget payloads, persona, workflow, authorization, connector state) is read-only input and never written.
- [x] One-way data flow: runtime clients → validate at boundary → immutable state → props down, typed events up. Components never receive a bus, router or store handle. *(clients → validate at the boundary → store → props; components emit events only.)*
- [x] **Update pipeline** per bus event: receive and validate → **gate on checkpoint** (queue if active) → coalesce within one animation frame → mark refreshing immediately and start the 30s timer → apply inside a low-priority transition → confirm render, then clear the indicator and record `zone_render_complete`. *(receive/validate, gate on checkpoint (queue + drain), coalesce per frame, mark refreshing immediately, apply in a transition, confirm render. Checkpoint gate is exercised by tests; the controller arrives in Stage 5.)*
- [x] Refresh indicator clears **only after** updated data renders (premature clear is a test failure). Becomes a warning at 30s (provisional), without claiming the data is stale. *(clears only on render confirmation of the applied version; the 30s warning keeps the data and does not block.)*
- [~] Zone re-render on event **< 400ms P95**. *(partly done: received-to-rendered time is measured per update and reported (`onMetric`, `zone_render_complete`). No P95 assertion on a throttled profile yet.)*
- [~] Auto refresh every **5 minutes** regardless of events (provisional); triggers for technician: status change and work order open. Timers computed from timestamps so a throttled background tab reconciles. Pause the 5-minute timer during a checkpoint. *(partly done: 5-minute timer (timestamp-based, pauses during a checkpoint) and refresh-all on reconnect done. Trigger events (status change, work order open) need a bus event type and are not built. Owner and type of the timer still open (Q20).)*
- [x] Navigation-set changes applied as **one update**, no partial set visible.
- [x] **History hydration:** HistoryList shows loading immediately after main render, never blank; Aggregator delivers in a later pass; canvas never fetches history or uses the pointer; `request-more` relayed through an approved channel (contract OPEN). *(loading first, delivered in a subsequent pass, never blank; request-more relayed on scroll with a button fallback. The delivery contract is still open (Q5).)*
- [~] `degraded_fields` handling per the table in SDD §7.6 (layout_config, zone data, history pointer). *(partly done: layout_config handled. A missing history pointer shows an empty history. Zone-data degradation arrives as a supplied zone status.)*
- [ ] **Persistence manager (shell-owned):** persistence-capable instances mounted in a persistent host and projected into layout slots via portals. Only **WorkflowStepper** and **AssistantPanel** are P0 persistence-capable (PhotoCapture on watchlist). The component never self-elects. Test: same component ephemeral in one composition and persisted in another. Persist continuity only (scroll, open substate, conversational surface), never authoritative state. A persisted instance that loses upstream must visibly show unavailable.
- [ ] **Assistant session** in the runtime (not the panel): WebSocket client, render-only cache of turns keyed by conversation reference, supplies connection state. Persistence of conversation across screens is OPEN (Q21). Support both.
- [x] Bus connection: SSE; silence detection (twice the heartbeat interval); backoff 1s/2s/4s/8s with jitter capped at 30s; resume via last event ID or refresh every zone on reconnect; escalate to the error banner after 3 attempts or 30s. *(reconnecting connection with silence detection (2x heartbeat), 1/2/4/8s backoff with jitter capped at 30s, escalation after 3 attempts or 30s, manual retry, last-event-id offered. Real EventSource source written and untested against a real bus (URL and auth are open, Q4).)*
- [x] Event ordering/duplicates: request a sequence field from Integrations; make zone updates idempotent in the meantime (R14). *(per-zone sequence numbers drop replays and out-of-order events when the bus supplies them. The sequence field is still to be requested from Integrations.)*
- [~] While disconnected: last state preserved, DegradedBanner (warning), staleness on affected zones, local interaction and drafts kept, **write and authorization-dependent actions visibly unavailable**, restored on reconnect. Delivered through a connectivity value passed down as a `disabled`/`unavailable` prop. No new gating component. *(partly done: last data kept and marked not up to date, warning banner persists, drafts unaffected, `canWrite` is false. There are no write controls yet to show as unavailable.)*
- [ ] Outbound clients: HTTPS with **idempotency keys** for decisions, audit stubs and feedback; WebSocket only for the assistant.
- [~] Only `@clients`-layer code touches the network; egress allow-list asserted in e2e. *(partly done: lint enforces it. No egress allow-list e2e yet.)*

---

## 10. Navigation (1.0 SR24/25, 1.3 §6/§7.5/§9.5, 1.2 §5.15, SDD §10)

*(Verify against BRD 1.1 once you have it.)*

- [x] **Universal destinations come from a shell constant**, never the persona registry or catalog: Dashboard on all viewports, **More** on mobile, **Settings** on tablet/desktop. They are passed to nav as a **separate guaranteed set** from the `layout_config` destination list. Dashboard renders even with no registry entry.
- [x] **Technician:** mobile = Dashboard, Work Orders, Assets, More. Tablet/desktop = Dashboard, Work Orders, Assets, Settings.
- [x] **Estimator:** mobile = Dashboard, Quotes, Field Review, More. Tablet/desktop = Dashboard, Quotes, Field Review, Settings. (P1 for sets beyond the technician; estimator entry points on Dashboard are undefined, SDD R16/Q19.)
- [x] Desktop/tablet: fixed left **NavigationRail** (SDD proposes 80px; 1.1 owns dimensions). Settings pinned at the bottom as a labeled item (icon above label, both Warm Cream).
- [x] Mobile: bottom **TabBar** (SDD proposes 56px + safe-area inset), max 5 items (Dashboard, up to 3 role items, More); role items beyond the third overflow into More in order.
- [~] **More menu (mobile only):** three floating actions above the button (Ask Olannah, Feedback, Settings), circular icon button + label card (title + short description), dim overlay at z-250, tap overlay to close, Esc closes, first item focused, focus returns to More on close. Role-specific overflow destinations may appear too. Composing layer owns open state. *(partly done: menu, overlay, focus trap and Esc done. Ask Olannah and Feedback surfaces not built (a plain 'not available yet' toast shows).)*
- [x] Assembly is a pure function (`assembleNavigation`) implementing the degradation hierarchy: keep last good set → omit unknown/duplicate/invalid destination (log) → universal-only → recovery surface.
- [x] Destination catalog: bundle the generic catalog as a versioned static file (ADR-011); tenant labels and offline flags arrive via context. Still implement the catalog-unavailable path. Identifiers never change; matching and restoration use **identifiers, never labels or routes**.
- [x] Persona registry rejects duplicate destination identifiers; keep first, suppress later, log.
- [x] **Active state:** exactly one item active; none on screens outside the nav set; nearest parent never highlighted; mobile overflow item active → More shows active visually while the item is exposed as `aria-current`. Indicator = leading vertical bar on rail, short bar above icon on tab bar, `--color-brand-accent`, ≥ 3:1 against Evergreen Dark, **plus** heavier label weight. Never color alone.
- [x] Nav colors: labels and icons **Warm Cream at full opacity in every state**; Moss Gold only for the indicator shape; **never** Warm Cream on a Moss Gold fill; hover fill Evergreen Hover `#3D6050` on tablet/desktop only.
- [x] **Unavailable destination:** keeps full contrast (no 40% opacity), shows the wifi-off marker (`--icon-nav-unavailable`, Warm Cream) next to label/icon, stays focusable, announces as unavailable with the supplied reason, activates to an explanation (toast), not navigation. Coexists with the active indicator.
- [~] Labels never uppercase, no letter spacing; truncated labels keep full text for assistive tech (max length OPEN, risk at 375px for "Field Review", "Portal Delivery"). *(partly done: no uppercase or tracking. Max label length still open (Q18).)*
- [x] Selection emits an event; the canvas performs the route transition.
- [~] Nav has **no permission logic**. Access denied on selection → stay on screen, toast ("You don't have access to this area."). *(partly done: nav has no permission logic. The access-denied path is not built.)*
- [ ] **Access revocation:** on signal for the current destination, route to Dashboard within **400ms P95**, show the supplied message (persists until dismissed, rendered via InlineError inside Dashboard), move focus to the message, **leave the nav set unchanged**. Build against an injectable fixture signal since the format is OPEN.
- [x] **Nav component failure:** nav-zone-only recovery surface with **Dashboard + Refresh** only, built from foundation components, in **< 100ms**, one toast; Refresh success clears it automatically.
- [~] Offline: keep rendering the last set, no clear/collapse/reorder; selecting an offline-unavailable destination → stay + toast ("needs a connection"). *(partly done: last set is kept and unavailable items explain themselves. Reconnect behaviour pending.)*
- [ ] During a checkpoint nav is non-interactive (inert); selections made then are not stored or replayed; set changes are queued and applied after; if the current destination disappears, stay on screen with no item active. At checkpoint end, restore the snapshot and mark the matching item active within 100ms.
- [x] Router keyed by destination identifier; skip link first on every screen; rail and tab bar are labelled `nav` landmarks.

---

## 11. Component library (1.2): 45 components

**Global rules for every component** (1.2 §5.2, §5.13, §5.14; SDD Appendix E):
- [x] Renders **only from typed props**; same props produce the same render; no default/placeholder business data (no data → empty state).
- [x] Emits **typed events upward**; never touches the bus, router, store, or network. Declares every emittable event.
- [x] Holds **presentation state only** (expanded/focused/hovered); no business-state copies.
- [x] Token-only styling; no hard-coded values, no local tokens, no outer margin, no z-index.
- [x] **Never derives:** status, sort order, counts, summaries, validity, error messages from codes. Supplied text only. Relevance-based field selection is allowed; correctness-based suppression is forbidden.
- [x] Declares applicable state dimensions (data, interaction, runtime) and marks inapplicable ones **not applicable** (never omitted). One state per dimension at a time.
- [~] Declares and **demonstrates** accessibility obligations: contrast, 44px target, focus, screen-reader behavior, reduced motion. *(partly done: axe passes on the shell and screens. Per-component demonstration continues.)*
- [x] Color never the sole carrier of state; shape + accessible label always.
- [x] Single implementation per component; persona/screen differences via props.
- [~] Machine-readable **manifest** per component (ADR-009); CI fails if an applicable state has no story or an a11y obligation is undeclared. *(partly done: manifests and a CI-checked test done. Per-state stories need Storybook.)*
- [ ] Data-bearing components declare a data contract: per field type, required/optional, **specific semantic meaning** (e.g. "departure date", not "date"), freshness, absent/stale behavior. No source named. Stale never shown as current.
- [~] Utility register kept separate from the catalogue (LiveRegionManager, FocusScope/FocusReturn, BlockingScope, PortalHost, VisuallyHidden, useReducedMotion/useViewport, TimerSource). *(partly done: FocusReturn, LiveRegions, PortalHosts, useViewport done. BlockingScope and TimerSource pending.)*
- [ ] Storybook state matrix + axe for each component.

**Foundation (P0, ephemeral)**
- [x] Surface (only structural-background owner; 4 surface tokens; no shadow) · SectionHeader (sm to lg only) · Label · Icon · Button (variants primary/accent/ghost; outcome-named labels, never "submit/ok/yes/cancel"; emits `activate` only; writes route via checkpoint) · Link (never a write/destructive action).

**Data display (P0)**
- [~] KeyValue · DetailRow (2/3 columns → 1 on mobile; trailing status supplied) · RecordList (supplied order, windowed, `row-select`) · HistoryList (two-pass, `request-more`, progressive scroll) · **WorkflowStepper** (persistence-capable; `step-select`, `step-advance`; never advances itself). *(partly done: KeyValue, RecordList, HistoryList, StatTile built. DetailRow and WorkflowStepper not yet.)*

**Input and control (P0; Select and DatePicker P0.5)**
- [~] TextInput · LookupField (query event in, supplied results out; no debounce/cancel/stale logic inside) · PhotoCapture (entry point only; watchlist) · FormField (visible label always, never placeholder-only) · Select · DatePicker (bounds supplied). *(partly done: TextInput and FormField only so far.)*
- [~] Controlled-component model: composing layer owns values; inputs remount without losing them. Structural validation allowed in input, business validation never. *(partly done: holds for TextInput.)*

**Feedback and status (P0; HealthBadge P0.5)**
- [x] StatusPill · StatusIndicator · SyncDot (freshness and connectivity as **separate** dimensions) · Skeleton · Toast (7s default, pauses on hover/focus, never over checkpoint) · InlineError (code, meaning, suggested action all supplied; **never show codes to worker**) · DegradedBanner (warning token; not a failure) · EmptyState (explanation required) · HealthBadge.
- [x] Distinct conditions stay distinct: loading, empty, stale, syncing, degraded, unavailable, error, warning, blocking.

**Visualization (all P0.5)**
- [ ] ProgressRing · SLAIndicator · BarChart · LineChart · DonutChart (≤ 5 series, text alternative, non-color differentiation, centered value, empty state).

**System surface (P0)**
- [ ] CheckpointOverlay · CheckpointInitializing · DiffView · AccountabilityStatement · DecisionControls · ConfirmationGesture · AcknowledgmentControl (section 13).
- [ ] **AssistantPanel** (persistence-capable): secondary only, hidden by default, never occupies primary zone space, floating bottom-right trigger on desktop/tablet expanding upward at z-300, bottom sheet via More on mobile, white body with Evergreen header, runtime dimension connected/reconnecting/disconnected.
- [ ] **FeedbackForm:** captures current screen/view context **automatically**; topbar text link on tablet/desktop, More menu on mobile (bottom sheet); draft owned by composing layer; submission state supplied. Capture structured context, not a screenshot (SDD proposal, confirm with Product).

**Navigation components (P0):** NavItem, NavigationRail, TabBar, MoreMenu (section 10).

**Widget (P0)**
- [ ] **WidgetContainer** pipeline: type + version check → structural validation → renderer lookup → render. **Display-only at P0**: no action controls, no writes. Unknown/unsupported/invalid → fallback with supplied message, distinct diagnostics for unsupported vs invalid, no schema/type/code shown to the worker. Degraded only when **supplied**, never inferred. Renderers compose library components only. CSS containment so a widget cannot draw over the checkpoint layer. **Blocked until the shared widget contract exists (Q6)**, so ship it fallback-only first.

**Governance**
- [~] Inventory only contains components that trace to an approved prototype screen; deferred register for exclusions (P1); promotion rules for P0.5 → P0. *(partly done: deferred items are listed in DESIGN_REVIEW.md.)*
- [x] Third-party embeds excluded from the contract until a containment standard exists.

---

## 12. Checkpoint, the highest-risk surface (1.0 UR13, 1.3 §8.7/§11.6, 1.2 §5.10, SDD §11)

*(1.4 itself is not in the files I read. Re-verify against it.)*

**Invariants:** fail closed · no ambiguous terminal state · render, do not resolve.

- [ ] Single **checkpoint controller** (finite state machine) is the only code that can mount the surface, and only on a validated trigger. The canvas has no logic that decides a checkpoint is needed.
- [ ] Mounts in the z-700 portal host as a **sibling of the canvas root**; **BlockingScope** applies `inert` (polyfilled), `aria-hidden`, scroll lock and pointer blocking to the root; FocusScope traps focus.
- [ ] Appears **< 200ms P95** after trigger, without navigating away; workspace stays visible behind it.
- [ ] Focus moves to the checkpoint container/heading, **never pre-focuses approve or reject**. Announced **assertively** (P0), including triggered-by source and description.
- [ ] No close/minimize/dismiss control. Escape and browser Back do nothing. Rotation/viewport change reflows the **same instance**.
- [ ] A second trigger while one is active is rejected immediately (not queued), and the trigger logic is notified.
- [ ] **Fixed card order:** checkpoint context + triggered-by source (before any diff), DiffView, AcknowledgmentControl, DecisionControls. Nothing in between.
- [ ] CheckpointInitializing: controlled wait, max **3000ms** diff wait, then diff-load-failure; reserved layout with non-interactive skeleton, `aria-hidden`. Decision-ready within **500ms P95** of a valid diff.
- [ ] DiffView: target system, record ID, originating agent/workflow, current vs proposed per field; changed fields differ by **more than color**; read-only; immutable after first render; single column at narrow widths.
- [ ] AccountabilityStatement identical for every persona and system, primary hierarchy, never tooltip/footnote.
- [ ] **AcknowledgmentControl:** full-width bordered Sage Mist container, fixed statement "I have reviewed the proposed changes shown above.", right-edge toggle (empty Warm Slate circle → filled Moss Gold circle with white check, border turns Moss Gold, 80ms). `role="checkbox"` + `aria-checked`, full-text `aria-label`, single Tab stop between diff and decision controls, Space activates, whole container is the target (≥ 44px). Interactive only at decision-ready. State scoped to **checkpoint ID**; a new ID resets; preserved only if the same immutable instance revalidates after reconnect.
- [ ] `approveEnabled = decisionReady && acknowledged[checkpointId] && !submitting && upstreamCondition.ok` (supplied, never inferred). Approve disabled until then; **Reject is always available** with a single action.
- [ ] Approval needs a deliberate **ConfirmationGesture**; one tap never approves.
- [ ] Controls offer **only approve and reject**, outcome-labelled; inert after the first decision (exactly one decision event per instance).
- [ ] Decision event: checkpoint ID, event ID (generated once, reused on retry), session ID, worker ID, timestamp, **immutable payload reference, never the executable payload**. Complete only when the bus **acknowledges** (< 100ms emission). Retry within a configurable window (proposed 5s).
- [ ] **12 terminal states**, each with worker message + one audit-stub attempt: approved, rejected, timeout, session abandoned, render failure, diff load failure, payload mismatch at submission, upstream mutation, reconnection validation failure, component load failure, approval submission failure, rejection submission failure.
- [ ] Audit stub: separate event, one attempt per terminal state, never blocks dismissal; contains checkpoint ID, event ID, session ID, worker ID, timestamp, outcome, permitted diff fields (allow-listed pure function), accountability text **as rendered** (captured at render), **no credentials/tokens**.
- [ ] Timeouts: inactivity warning **8 min**, expiry **10 min**, configurable without code change; timestamp-based; activity = pointer/keyboard/touch/scroll in the surface.
- [ ] Connectivity loss inside a checkpoint: say connection lost, nothing submitted, action must be revalidated. Stay blocked until a validation result arrives (within 2000ms or fail). Valid → continue with diff intact.
- [ ] Post-resolution: dismiss within 100ms, restore snapshot of prior workspace within 100ms, apply queued updates afterward, transient confirmation 7s ("submitted" or "nothing was submitted", never "completed"), focus returns to prior element or fallback.
- [ ] Component-load failure: safe fallback from foundation components, shell emits the load-failure stub, held action stays fail-closed.
- [ ] Updates, nav changes and toasts arriving during a checkpoint are queued; the diff never changes.
- [ ] Usable at **200% zoom** and OS text scaling at 375px, no clipped values.
- [ ] Open items: multi-tab behavior (R17), who emits session-abandoned stub (Q10), retry window (Q11), immutable reference form (Q9), revalidation mechanism (Q12), protocol-error telemetry (Q13).

---

## 13. Error, degraded and empty states (1.0 §6, 1.3 §7.4, SDD §12)

**Principle:** fail visible, never fail silent. Plain language, recovery action when one exists, no codes/stack traces/service names (these go to the log).

- [x] **Degraded** = warning token + triangle. **Failure** = error token + error circle. Distinguishable at a glance without reading. Color never alone.
- [x] **Empty is not an error**: explains why it's empty and what would fill it; no warning/error tokens; never blank (zones, lists, charts).
- [~] Boundary topology: Root (recovery screen), Zone (registered unavailable), Navigation (recovery surface), Widget (fallback), Checkpoint (safe fail-closed fallback), Persisted instance (visible unavailable). *(partly done: zone, navigation and root recovery done. Widget, checkpoint, persisted boundaries pending.)*
- [~] All 15 taxonomy rows have a detector, handler, telemetry event and test: *(partly done: rows 1 to 12 and 14 done. 13 is partial and 15 (access revoked) needs the revocation signal.)*
  - [x] 1 Session not confirmed (`session.slow`)
  - [x] 2 Context delivery timeout
  - [x] 3 Context hard timeout
  - [x] 4 Unrecognized schema version
  - [x] 5 Malformed global envelope
  - [x] 6 Zone data source unavailable (indicator + message + retry or "no retry possible")
  - [x] 7 Malformed zone payload
  - [x] 8 Bus disconnect (warning banner; persists until restored; doesn't obscure content)
  - [x] 9 Reconnection failure (banner → error token, manual retry + contact support)
  - [ ] 10 Persisted component connection loss
  - [x] 11 Refresh timeout (30s, warning indicator, last data kept)
  - [x] 12 Session expired
  - [~] 13 Navigation errors *(partly done: unknown, duplicate, degraded and unavailable done. Access denied and revoked pending.)*
  - [x] 14 Navigation component failure
  - [ ] 15 Access revoked
- [x] Shell-owned screens built from foundation components: **session loading**, **workspace recovery**, **session expired**, **unknown-role fallback**, **navigation recovery surface**.
- [ ] Schema-mismatch events alert engineering; the worker sees only the recovery screen.
- [ ] Support gets the plain-language text for every state a worker can see.
- [ ] Degraded-state catalog for the 12-week build is OPEN (Q25).

---

## 14. Persona deliverables

**Field technician (mobile, Week 9, P0): build first, everything is mobile-first**
- [~] Technician layout template; 375px; one-handed; touch only. *(partly done: Dashboard content, context rail and mobile collapse built. Other screens pending.)*
- [~] Screens from the 5-screen mobile prototype (get the Figma and trace every component to a screen, per the inventory rule). *(partly done: Dashboard built from the approved designs (summary tiles, next job, later today, notice, context rail). Work orders, work-order steps and checkpoint screens not yet.)*
- [~] Nav: Dashboard / Work Orders / Assets / More. *(partly done: Dashboard / Work Orders / Assets / More done.)*
- [ ] P0 components all in place, including WorkflowStepper, PhotoCapture, AssistantPanel via More.
- [~] Refresh triggers: status change, work order open. *(partly done: 5-minute and reconnect refresh done. The two trigger events need a bus event type.)*
- [x] History hydration for site/job history.
- [ ] Checkpoint fully working on mobile.
- [ ] Full automated a11y audit with zero violations, manual keyboard + screen reader pass signed off, throttled-phone performance assertions pass, rollback drill done in staging **before Week 9**.

**Estimator (desktop, Week 12, P0.5)**
- [x] Estimator layout template (new template only; **zero** changes to runtime orchestration).
- [~] 5-screen desktop prototype traced to components. *(partly done: estimator dashboard (figures with captions, priority queue with status pills) built. Field review, quote and approval screens not yet.)*
- [x] Nav: Dashboard / Quotes / Field Review / Settings (mobile: …/More).
- [ ] P0.5 components: Select, DatePicker, HealthBadge, ProgressRing, SLAIndicator, BarChart, LineChart, DonutChart.
- [~] Context zone as fixed 240px side rail; floating AI trigger bottom-right; topbar feedback link. *(partly done: 240px context rail done. AI trigger and feedback link pending.)*
- [ ] Dashboard entry points for estimator work (undefined, Q19).
- [ ] Charts chunk lazy-loaded so technician devices never download it.
- [ ] Ships dark behind the `personas.enabled` flag until Week 12.
- [ ] Open: do billing coordinator and dispatcher share components? (affects reuse now, 1.0 OQ8)

**Adding any persona must cost:** template + registry config + (maybe) components + fixtures + e2e scenarios + a11y pass, with **no runtime/shell change**.

---

## 15. Accessibility (1.3 §11, 1.2 §5.14, 1.0 UR15)

- [~] **WCAG 2.1 AA** minimum everywhere; AAA targeted for primary-action text and checkpoint (AAA checkpoint contrast = P1). *(partly done: AA structure checked by axe. Contrast via the gate. Manual passes pending.)*
- [x] Focus order: nav → primary content → context; reading order left-to-right, top-to-bottom; DOM order = focus order; no `tabindex` hacks.
- [x] Landmarks: rail/tab bar = `nav` with names, primary zone = `main`, context zone = `complementary`. Skip link is the first focusable element and targets the primary zone.
- [~] Focus traps **only** in modal/drawer/checkpoint; focus returns to the opener on close via a single `FocusReturn` service with a fallback chain. *(partly done: focus return and the More menu trap done. Other overlays pending.)*
- [ ] Focus rules: removed nav item → active item (else Dashboard); revocation → the supplied message; checkpoint → container; More menu → first item.
- [~] Esc closes More menu and drawers; **never** a checkpoint. *(partly done: More menu done. Drawers pending.)*
- [~] `aria-live`: checkpoint **assertive (P0)**; everything else polite (P1 content). Build both channels together via one manager with de-duplication. *(partly done: polite and assertive regions built. Checkpoint assertive pending.)*
- [ ] Validate the acknowledgment/approve-enable announcement with VoiceOver, TalkBack and NVDA for duplicates.
- [~] Icon labeling (informative vs decorative), explicit form labels (never placeholder-only), 44px targets, visible focus, shape + label for every state. *(partly done: labels, icons and 44px done for built components.)*
- [~] Reduced motion honored by every animated element (P0 implement, P1 full test coverage). *(partly done: global rule and shimmer stop done. Coverage tests pending.)*
- [ ] 200% zoom and OS text scaling work.
- [~] Per-component a11y obligations are in the manifest and demonstrated in stories. *(partly done: manifests done. Stories pending.)*
- [ ] Manual testing scheduled from **Week 5** (not just at the end): VoiceOver (iOS/macOS Safari), TalkBack (Android Chrome), NVDA (Firefox/Chrome).
- [ ] An automated audit is necessary but **not sufficient**. Manual keyboard and screen-reader sign-off before each persona release.

---

## 16. Performance (1.0 §7, SDD §13)

- [ ] Session → usable canvas **< 1,500ms P95** (PCR 800ms + canvas 700ms).
- [ ] Layout + scaffold **< 200ms**; first meaningful render **< 300ms**; content settled **< 700ms** (all from context receipt, P95). Widgets inside the 700ms.
- [ ] Zone re-render **< 400ms**; access-revoked routing **< 400ms**; nav recovery **< 100ms**; checkpoint **200 / 500 / 100 / 100 / 100ms**.
- [ ] Loading screen visible **≤ 100ms** from page load.
- [~] Proposed bundle budgets (confirm with a Week 1 to 2 spike): core JS ≤ 170KB gz, CSS ≤ 25KB, persona chunk ≤ 60KB, checkpoint chunk ≤ 40KB, fonts ≤ 100KB. *(partly done: measured: 410 KB gzipped JS across ALL chunks (all routes) and 6 KB CSS. The two largest chunks (~98 KB each) are almost certainly React and the Next runtime, so the SDD's 170 KB core budget (written for Vite) is probably unrealistic on Next. Per-route first-load not yet measured. Revisit the budget.)*
- [ ] Preload Inter 400/500/600 and Inter Tight 600; preconnect to bus/context/telemetry origins.
- [ ] Measure freeze cost of the context object on a low-end device; fall back to dev-only freezing if over budget (decision made from data).
- [~] Named `performance.mark`s matching BRD clocks (`session_confirmed`, `context_received`, `layout_resolved`, `first_meaningful_render`, `context_settled`, `zone_event_received/zone_render_complete`, checkpoint and revocation marks). Aggregate to P95 by persona/viewport/build. *(partly done: `zone_render_complete:<zone>` recorded per update and measured. The other marks pending.)*
- [ ] CI asserts canvas-side budgets against the mock upstream with CPU throttling.
- [~] Windowed RecordList/HistoryList; selector-scoped subscriptions; zone updates in transitions. *(partly done: HistoryList loads progressively on scroll. No list windowing (virtualization) yet; not needed at current sizes.)*
- [ ] Availability SLI (99.9%) reported **twice**: end-to-end and canvas-only.

---

## 17. Security (1.0 SR23, SDD §15)

- [x] Canvas is **not** an authorization boundary; hiding/disabling a control grants or denies nothing.
- [ ] Every consequential action traceable to worker identity + session ID in the audit record; missing identity = flagged audit failure.
- [~] No credentials/PII/session tokens stored or logged; **automated log scan** in e2e. *(partly done: logger allow-list done. No e2e scan yet.)*
- [x] Logger accepts only schema-defined events with allow-listed fields and **no free-form strings**.
- [~] CSP: `default-src 'self'`, hashed inline bootstrap, `connect-src` limited to bus/context/assistant/telemetry origins, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`. HTTPS only + HSTS at the edge. *(partly done: CSP and the other headers are set and tested. `unsafe-inline` for scripts remains, and upstream origins are not added yet.)*
- [ ] SSE auth: header-based requires a fetch-stream reader; cookie-based must be HttpOnly/Secure/SameSite (OPEN, K3).
- [~] All supplied text rendered as text; widget link schemes allow-listed in the validator. *(partly done: no raw HTML rendering. Widget link allow-list pending.)*
- [ ] E2E asserts the page only contacts allow-listed origins.
- [ ] Checkpoint protections: approval carries an immutable reference only; event ID reused on retry; diff/statement/reference frozen; no single-tap approval.

---

## 18. Observability (SDD §16)

- [~] Common event envelope: `event`, `severity`, `ts`, `build`, `corr`, `tenant`, `layout`, `viewport`, `schema`, `zone`, `detail` (enumerated reason code). *(partly done: event, severity, ts, detail done. build, corr, tenant, layout, viewport pending.)*
- [~] Event catalogue implemented: session/boot, layout, zones, connectivity, navigation (`nav.*`), widgets, checkpoint (`checkpoint.<terminal state>`, `protocol_error`), performance. *(partly done: boot, layout, zone, nav, auth events done.)*
- [~] **Telemetry and audit are separate channels. Never mix.** *(partly done: telemetry exists. Audit channel not built.)*
- [~] Ring buffer, batched HTTPS, beacon on page hide, capped buffer flushed on reconnect. Logger behind an interface (destination OPEN, Q13/Q14). *(partly done: in-memory ring buffer (200) and replaceable sink. Batching and beacon pending.)*
- [ ] Alerts: any schema-mismatch, assembly P95 > 1.5s, zone re-render P95 > 400ms, any `checkpoint.protocol_error`, boundary trips, bus-disconnect rate.
- [ ] Runbook per canvas error state (who's paged, which upstream team owns the fix); dashboards live **before** the technician release.
- [ ] Dev overlay (zone states, schema version, connection, queued updates, checkpoint phase), compiled out of production.

---

## 19. Testing strategy (SDD §17)

- [x] **Static:** types, lint, boundary, token and contrast gates on every commit.
- [~] **Unit (Vitest):** validators, navigation assembly, layout resolution, update pipeline, timers, state machines, audit-field filter. *(partly done: boot, navigation, zones, contracts, state done.)*
- [~] **Component (Testing Library + Storybook + axe):** every applicable state of every component, keyboard operation, accessible names. *(partly done: component tests and axe done. Storybook pending.)*
- [~] **Contract:** fixture suites for every contract (valid/unknown-version/malformed), shared with upstream CI. *(partly done: fixtures and tests done. Not yet shared with upstream CI.)*
- [~] **Integration** against the mock upstream (HTTP, SSE, WebSocket): boot, refresh, reconnect, revocation, checkpoint. *(partly done: boot, auth, runtime (bus loss, reconnect, refresh, history) covered with fake sources. A real SSE/WebSocket mock server pending.)*
- [ ] **E2E (Playwright)** scenario groups: **Boot · Personas · Zones · Connectivity · Navigation · Checkpoint · Widgets · Accessibility** (plus **Auth** and **Onboarding** [NEW]).
- [~] Turn every "code review audit confirms…" into an automated check (SDD §17.2): context-not-mutated hash test, egress allow-list, overlay-only-via-controller, state-category lint, no client logic (second fictional tenant), credential log scan, no error-code mapping, no hard-coded values, zone-has-unavailable (compile-time), widget renderers import only library/tokens, persistence is shell-owned. *(partly done: context immutability, no-network, no-storage, token-only and no-derivation rules automated. More to add.)*
- [ ] Browser matrix: Chrome 100, Firefox 100, Safari 15 (oldest builds, specifically for `inert` and `:focus-visible` fallbacks) + latest Chrome/Firefox/Safari/Edge.
- [ ] Mobile: mid-range Android + current iPhone; 375px for every critical flow.
- [ ] Network profiles: throttled, forced offline, flaky transitions.
- [~] Zero axe violations on every screen state; keyboard-only completion of every critical flow. *(partly done: axe clean on the shell, the Dashboard, and every live state (refreshing, delayed warning, connection lost, reconnection failed, history loading, delivered, unavailable). Keyboard-only flows still manual.)*
- [ ] Performance traces with CPU throttling per PR; bundle analysis.

---

## 20. Build, deployment and release (SDD §18)

- [ ] Environments: local/preview (mock + fault injection), test (mock + contract replays), staging (real upstream), production (per-tenant config).
- [ ] Static assets on a CDN; hashed immutable filenames; the HTML document and `runtime-config.json` short-cached; atomic deploy; rollback = repoint to the previous build.
- [ ] Update the existing Dockerfile and compose setup to serve the static build (depends on the static export vs Next server decision in section 0). Check how `lib/fetchHealth.ts` and the README (now "local-only") fit.
- [ ] Semantic versioning of packages; active contract versions in every telemetry event; code owners for tokens and contracts (producing team is a required reviewer on its fixtures).
- [ ] Rollback drill in staging before Week 9.
- [ ] Per-release artifacts: zone-checklist, SBOM.

---

## 21. Milestones (SDD §18.6; dates fixed by BRD: Week 9, Week 12, contract gate before Week 3)

| Weeks | Focus | Exit criteria |
|---|---|---|
| **1 to 2** | Foundations: framework decision, tokens + contrast gate, contracts + fixtures, mock upstream + fault injection, boot machine, static loading screen, foundation components, lint rules, perf/bundle spike, ratify ADRs. **Also: auth screens and mock SSO [NEW]** | Loading screen < 100ms; architecture rules run in CI; budgets confirmed |
| **Before 3** | Contract gate: K7, K8, K2, K3 frozen | Fixtures merged |
| **3 to 5** | Layout engine, zone host/lifecycle, update pipeline, data display, feedback/status, nav assembly, technician layout. **Technician onboarding [NEW]** | Technician layout assembles from mock within budget; zone fault scenarios pass |
| **5 to 7** | Checkpoint controller + surfaces, inputs, persistence manager, assistant panel, WidgetContainer (when contract exists), history hydration | All 12 terminal states pass; blocking verified on the browser floor |
| **7 to 8** | Hardening: full fault injection, manual a11y, device perf, security review, staging integration | Zero axe violations; P95 met on throttled profile |
| **9** | **Technician mobile release** | Sign-offs recorded |
| **9 to 11** | P0.5 components, estimator layout, estimator Dashboard entry points, **estimator onboarding [NEW]** | Estimator layout assembles within budget |
| **11 to 12** | Estimator hardening, a11y pass, desktop perf | Sign-offs recorded |
| **12** | **Estimator desktop release** | |

---

## 22. Open questions to chase (owner → needed by)

| # | Question | Owner | By |
|---|---|---|---|
| Q1 | Is resolved role in the session payload or the context object? | Identity + Intelligence | Wk 2 |
| Q2 | Session confirmation format; non-secret session ID? | Identity | Wk 2 |
| Q3 | Context delivery transport and re-delivery request | Intelligence | Wk 2 |
| Q4 | Bus format, subscription API, auth, ordering, heartbeat, resume | Integrations | Pre-Wk 3 |
| Q5 | History contract and request-more relay | Intelligence | Wk 5 |
| Q6 | Shared widget contract and governance | Intelligence + canvas | Wk 5 |
| Q7/Q8 | Checkpoint trigger payload; diff payload | Trigger Logic; Connector framework | **Pre-Wk 3** |
| Q9 to Q14 | Immutable-ref form, session-abandoned stub owner, retry window, upstream-change mechanism, protocol telemetry, audit format | Trigger/Write-Back/Audit | Wk 4 to 5 |
| Q15/Q16 | Revocation signal; Dashboard permitted for all? | Identity | Wk 6 / Wk 4 |
| Q17 | Destination catalog owner and tenant labels | Product | Wk 3 |
| Q18 | Max nav label length at 375px | Canvas | Wk 5 |
| Q19 | Estimator Dashboard entry points | Canvas + Product | Wk 9 |
| Q20 | Refresh timer owner and type | Intelligence + Integrations | Wk 4 |
| Q21 | Assistant history persistence | Intelligence | Wk 5 |
| Q22 | Error-code → message mapping owner | Integrations | Wk 4 |
| Q23 | Third-party embed containment | Integrations | Not first build |
| Q24 | Content and language standard | Intelligence + Product | Wk 5 |
| Q25 | Degraded-state catalog | Canvas + Integrations | Wk 5 |
| Q26 | Hard timeout value | Product | Wk 2 |
| Q27/Q28/Q29/Q30 | Focus fallback; toasts during checkpoint; second-tab behavior; topbar definition | Design / Trigger | Wk 3 to 5 |
| Q31 | Persona registry details | Intelligence | Wk 3 |
| Q32 | Checkpoint/blocking token name; AAA contrast | Design | Wk 2 |
| **N1 [NEW]** | **Onboarding spec: trigger, content, skippability, where completion is stored** | Product | Wk 2 |
| **N2 [NEW]** | **Auth scope: login UI ownership vs SSO redirect, password reset, role selection** | Product + Identity | Wk 2 |

---

## 23. Risks to watch (top of SDD §19.1)

Checkpoint trigger/diff payloads undefined before Week 3 (R1/R2, H/H) · context transport and re-delivery undefined (R3, H/H) · 700ms canvas budget on low-end phones (R5) · `inert`/`:focus-visible` gaps on the browser floor (R4) · widget contract missing (R6) · session-abandoned stub unowned (R7) · bus events out of order or duplicated (R14) · two tabs both showing a checkpoint (R17) · estimator has no defined entry points (R16) · manual a11y effort underestimated (R12) · **[NEW]** auth and onboarding built without a spec, risking rework when the real SSO lands.
