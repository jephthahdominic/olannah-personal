# Olannah Frontend: Staged Delivery Plan

Companion to [CHECKLIST.md](CHECKLIST.md). Section numbers (§) refer to that file. Today is **Wed 7 Oct 2026**; the near-term target is **Sat 10 Oct**.

## Honest scope

The full checklist is a 12-week build (technician Week 9, estimator Week 12). **It cannot be finished by Saturday.** What Saturday *can* deliver is a **walking skeleton**: Stages 0 to 3 below. It is a login, boot, shell, technician nav and Dashboard running on a mock backend, deployed to the existing dev environment. That is a demo-able foundation. It is **not** a production release.

## How shipping works today (from the repo)

- `.github/workflows/deploy.yml`: on push to `main`, detect changes, test, build the Docker image, push to ECR, and deploy to the dev EC2 box (earlier commits show SSH over Tailscale). PRs run tests only.
- Frontend CI runs **only `npm test`**. No lint, typecheck or build step, so a broken build can reach the deploy job. Fixing that is Stage 0.
- `frontend/Dockerfile` + `output: "standalone"` run the Next server on port 3000.
- Only `infra/environments/dev` exists. **There is no production environment yet.** The README now describes local-only; confirm whether the deploy workflow is still live before relying on it.

## Status (8 Oct)

| Stage | State |
|---|---|
| 0 Foundations | Done |
| 1 Contracts, auth, boot | Done |
| 2 Shell, components, navigation | Done, with the deferrals marked below |
| Auth hardening (sign in, sign up, security headers) | Done, see [SECURITY.md](SECURITY.md) |
| 3 Dashboard, live updates | Done. The dev deploy is **not done**: it needs a merge to `main`, which needs your go-ahead |
| 4 Remaining P0 components | **Partly done:** assistant panel + WebSocket, feedback, widget container, persistence manager. **Not started:** work-order screens and WorkflowStepper (need workflow-step event contracts), LookupField, PhotoCapture, Select, onboarding (needs a spec) |

`npm run verify` passes (token build, contrast gate, style check, lint, typecheck, 618 tests) and `next build` succeeds. **Committed and pushed to `frontend-dev` (not merged to `main`). Nothing has been checked in a real browser.** `[x]` = done and verified, `[~]` = partly done with a note.

## Stage 0: Unblock and lay foundations (Wed)

**Goal:** the repo can build safely and every later stage has rails.

- [x] Add CI gates: `lint`, `tsc --noEmit`, `next build` before the image build (§1, §20).
- [x] Decide static export vs Next server (§0). Default: keep `standalone` for now, with a client-only canvas, and revisit later. *(decided for now: keep `standalone`; revisit before production.)*
- [x] Remove create-next-app leftovers; self-host Inter + Inter Tight via `next/font/local` (§1, §2).
- [x] Token source file → generated CSS custom properties (colors, type, spacing, z-index, motion, icon sizes, reserved `--dark-*`); resolve the `blocking` vs `checkpoint` token name (§0, §2).
- [x] Global styles: Warm Cream workspace, no shadows, focus ring, reduced-motion rule, 44px target helper, breakpoints.
- [x] Lint-lite boundaries: ban hard-coded colors/z-index, ban storage APIs, ban fetch outside a `clients` folder, no `dangerouslySetInnerHTML` (§1).
- [x] Folder layout with enforced separation: `tokens/`, `contracts/`, `components/`, `clients/`, `runtime/`, `render/`, route groups `(auth)` and `(canvas)`.
- [x] Static loading screen (wordmark, message, progress) in the root layout, painting without JS (§5).

**Exit:** CI red on a broken build; loading screen visible; tokens drive all styling.

## Stage 1: Contracts, mock backend, auth and boot (Thu)

**Goal:** a worker can sign in against a mock and the shell boots through every early failure path.

- [x] Draft contract schemas + versions + valid / unknown-version / malformed fixtures: session, context envelope, layout config, bus event (§4).
- [~] Mock upstream (dev-only, compiled out of prod builds): session, context with configurable delay, bus events over SSE, a switch for technician / estimator / unmapped / undetermined role (§4). *(partly done: done as in-browser mock adapters behind interfaces. SSE, bus events and a separate mock server are still to do (Stage 3).)*
- [x] Auth behind an interface: login screen, progress, plain-language failures, logout, session-expired screen (§6). Mock provider returns technician and estimator fixtures.
- [x] `SessionClient` (token in memory only) and `purgeSession()` (§5).
- [x] Boot state machine through `awaitingSession`, `awaitingContext`, `contextDegraded`, `contextHardTimeout`, `resolving`, fallback screens (§5).
- [x] Validate and deep-freeze the context object; hash-identity test (§5, §19).
- [x] Shell-owned screens built from plain foundation components: loading, recovery, session-expired, unknown-role fallback.

**Exit:** Playwright or Vitest scenarios pass for: session never arrives, context at 900ms, context never arrives, unrecognized schema, malformed envelope.

## Stage 2: Shell, foundation components, technician navigation (Fri)

**Goal:** the technician layout assembles from the mock with real zones and navigation.

- [~] Foundation components with manifests and stories: Surface, SectionHeader, Label, Icon (Tabler wrapper), Button, Link (§11). *(partly done: manifests and a CI-checked test done. Stories need Storybook, which is not set up. Link is built; DetailRow, RecordList, HistoryList come with the Dashboard.)*
- [x] Feedback/status: Skeleton, StatusIndicator, StatusPill, SyncDot, Toast, InlineError, DegradedBanner, EmptyState (§11).
- [x] Layout template type with **required `unavailable`**; zone host (error boundary + skeleton + slice subscription); component registry (§8).
- [x] Layout resolution table (mapped, unmapped, undetermined, multi-role, degraded config) (§8).
- [~] Technician template: nav zone, primary zone, context zone; responsive collapse (§3, §14). *(partly done: template + responsive collapse built. Real dashboard content is Stage 3.)*
- [x] Navigation: universal destinations from a shell constant, `assembleNavigation`, NavItem, TabBar, NavigationRail, MoreMenu, active state, unavailable marker, recovery surface (§10). *(all of it built and tested. Estimator navigation uses the BRD set.)*
- [x] Skip link, landmarks, focus-return utility (§15). *(skip link, landmarks, `useFocusReturn`, live regions done.)*

**Exit:** technician mobile shell renders at 375px from the mock; a failing zone shows its unavailable state without affecting others; nav passes keyboard walkthrough.

## Stage 3: Dashboard, live updates, deploy to dev (Sat)

**Goal:** something real to demo, deployed.

- [x] Technician Dashboard zone(s) using data-display components (KeyValue, DetailRow, RecordList) on mock data (§11, §14). *(built from the approved designs with KeyValue-free StatTile, RecordList and the featured card, on mock data. Estimator dashboard too.)*
- [x] Bus client: SSE, silence detection, reconnect/backoff; DegradedBanner on disconnect; refresh indicator + 30s warning; update pipeline for one zone (§9). *(reconnecting connection, DegradedBanner on disconnect and failure, refresh indicator, 30s warning, update pipeline. Real EventSource written, untested against a real bus.)*
- [x] History hydration with HistoryList loading state (§9). *(loading, delivered, empty, degraded, unavailable and progressive load.)*
- [x] Fault-injection switches for the scenarios above (§4). *(dev overlay in mock mode.)*
- [~] axe pass on every built screen; manual keyboard pass (§15). *(partly done: axe is clean on the shell and every shell-owned screen. Login is not covered yet. Manual keyboard pass is still to do.)*
- [ ] Merge to `main`, let the existing pipeline deploy to the **dev** environment, smoke test. *(waiting for your go-ahead: this triggers the real pipeline and a deploy to the dev box.)*

**Exit (the Saturday milestone):** demo of login → boot → technician Dashboard on a mock backend, with disconnect and zone-failure behavior, running on the dev environment.

---

## After Saturday: path to production

**Stage 4 (about Wk 3 to 5): Real contracts and the rest of the technician flow**
- [ ] Contract gate closed in writing: checkpoint trigger, diff payload, context transport, bus format (§4).
- [ ] Remaining P0 components: inputs, WorkflowStepper, PhotoCapture, FeedbackForm, AssistantPanel + WebSocket client, WidgetContainer (fallback-only until the widget contract exists) (§11).
- [ ] Persistence manager (§9). Technician screens from the approved prototype, traced to components (§14).
- [ ] Technician onboarding once Product supplies the spec (§7).

**Stage 5 (about Wk 5 to 7): Checkpoint**
- [ ] Controller state machine, BlockingScope with `inert` polyfill, DiffView, AcknowledgmentControl, ConfirmationGesture, DecisionControls, 12 terminal states, audit stubs, timeouts (§12). Needs BRD 1.4 in hand.

**Stage 6 (about Wk 7 to 8): Hardening for technician release**
- [ ] Full fault-injection suite, browser matrix (Chrome 100 / Firefox 100 / Safari 15), real-device performance against the 1,500ms / 700ms budgets, manual screen-reader pass, security review, CSP, log scan (§15 to §19).
- [ ] Observability and alerts live; runbook per error state (§18).

**Stage 7: Production readiness (Wk 8 to 9)**
- [ ] **Create a production environment** (infra has only `dev`): separate infra, secrets, domain/HTTPS, CDN or Next hosting, `runtime-config.json` per env (§20).
- [ ] Pipeline: manual approval gate for prod, immutable image tags (already SHA-tagged), health check and automatic rollback; rollback drill in staging.
- [ ] Staging against real upstream services; sign-offs recorded.
- [ ] **Technician mobile release (Week 9)** behind `personas.enabled`.

**Stage 8 (Wk 9 to 12): Estimator**
- [ ] P0.5 components actually used by approved screens (Select; charts, HealthBadge and DatePicker are deferred), estimator layout/template only (no runtime changes), desktop screens, charts chunk, estimator onboarding, a11y and desktop performance pass, then release flag on (§14).

## Risks to Saturday

- Backend and upstream teams' contracts are unknown, so Stage 1 mocks are guesses. Keep them behind the contracts folder so they can change in one place.
- Product input needed: onboarding spec, auth scope (login UI vs SSO redirect), hard-timeout value. Defaults are proposed in §0 and §22.
- The 5-screen technician prototype isn't in the repo. Stage 3's Dashboard content is a placeholder composition until it's traced.
- BRDs 1.1 and 1.4 aren't in the repo; navigation and checkpoint details are second-hand until they are.
