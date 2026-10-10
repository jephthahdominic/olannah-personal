# Design Review: `ai-contexts/ui`

Reviewed against BRD 1.0, 1.2, 1.3 and the SDD (1.1 and 1.4 are still not in the repo). Eight unique images (`image.png` = `image copy 5.png`, `image copy 8.png` = `image copy 9.png`). Colors below were **sampled from the pixels**, not eyeballed.

## 1. What each image contains

| # | File | Title | Persona / viewport | States shown |
|---|---|---|---|---|
| A | `image.png` | Login & workspace assembly | Technician, mobile | 8: session verified/assembling, context delayed (10s), unrecognized context schema, role unavailable (universal workspace), role not mapped (default dashboard), navigation limited (Home + Work only), navigation verified (unknown destination omitted), session expired |
| B | `image copy.png` | Marcus · Technician dashboard experience | Technician, mobile | 5: assembling, ready, context update (store-manager note pushed), offline, access recovery (revoked job → Dashboard) |
| C | `image copy 2.png` | Marcus · WO-48213 progression | Technician, mobile | 8: assigned & prioritized, ready to arrive, safety pre-check, guided diagnosis, repair & verify, close out, human review, submitted |
| D | `image copy 3.png` | (untitled) Technician flow | Technician, mobile | Home, Work orders (search, filters, offline), active job, syncing, close-out (offline), Review & approve |
| E | `image copy 4.png` | Estimator flow | Estimator, desktop | Dashboard, Field review, Quote Q-2291, Approval checkpoint |
| F | `image copy 6.png` | Sections & refresh | Technician, mobile | 4: refreshing context, stale context (7 min), context section unavailable, unsupported insight format |
| G | `image copy 7.png` | Connectivity | Technician, mobile | 3: offline (drafts safe), restoring connection, reconnect failed |
| H | `image copy 8.png` | Navigation & access | Estimator, desktop | 5: access revoked, access denied, navigation failed to render, navigation unavailable, navigation updated (v18 → v19) |

## 2. What matches the BRDs (good news)

- **Palette is exact.** The most common pixel colors are `#2C4438`, `#FFFFFF`, `#F7F5F0`, `#EEF1EB`, `#345241`, `#B38A45`, `#6A675F`, `#B87333`, `#3A7D44`, `#C0392B`, `#2A4035`, `#1A1A18`. All are existing tokens.
- **Border-led, no shadows**, as 1.3 requires.
- **Status vocabulary** uses shape + label + color (warning triangle, error circle-cross, success circle-check), always with plain text.
- **Degraded vs failed vs empty** are visually distinct (amber/triangle vs red/circle-cross).
- **Zone isolation** is designed (F): "Context section unavailable", "Section isolated", "Still available: Work order / Job steps / Draft notes", and the primary work card stays usable.
- **Unsupported insight** falls back safely with "Continue without insight" (matches the WidgetContainer contract).
- **Staleness** warns with a warning triangle and "Stale · 7 min", with **Retry refresh / Use current view**.
- **Offline** keeps content, marks it read-only, and disables writes visibly ("Writes unavailable offline").
- **Revocation** (B, H): routes to Dashboard, explanation "stays visible until dismissed", navigation set unchanged. **Access denied** stays in place with nothing written.
- **Submitted** says "queued, not executed" (technician step 8). This matches the "submitted, not completed" rule.
- **Insights are display-only** with an "Evidence-backed" label.
- **Persona context rail** on estimator screens maps to the Context Zone (Sage Mist).

## 3. Conflicts between the designs and the BRDs (need a decision)

These are listed by impact. For each, "BRD wins" is the default under 1.3 §13 unless Design/Product says otherwise.

### Critical

1. **The navigation surfaces are inverted from the BRD.** 1.3 §7 says the navigation zone is **Evergreen Dark in every environment** with Warm Cream labels. In every design the **header is Evergreen Dark but the bottom tab bar and the estimator rail are white**, with dark labels. The active indicator is a sage fill, not a Moss Gold bar.
2. **Navigation items differ.**
   - Technician mobile shows **Home / Work / Scan / Notes**. BRD says **Dashboard / Work Orders / Assets / More**. There is no More menu, no Assets, and no Settings anywhere. "Scan" and "Notes" are in no document.
   - Estimator rail shows **Dashboard / Field review / Quotes / Approvals (3) / Customers** plus a help icon in H. BRD says Dashboard, Quotes, Field Review, **Settings**. "Approvals" and "Customers" are new, and the order differs.
   - The rail is wide with labels beside icons (E) in some screens and icon-only (H) in others. BRD/SDD say an 80px rail with icon above label.
3. **Session expired keeps workspace content on screen.** A shows the work order still visible and "2 drafts preserved locally (1 note, 3 photos)". BRD error row 12 requires the canvas to **clear all workspace content immediately** with no data retained in the browser, and ADR-010 says memory-only.
4. **The designs assume offline-first local persistence.** "Drafts safe", "preserved on this device", "notes, photos and signatures upload automatically when service returns", "Writes unavailable offline", and an on-device drafts list (G). That conflicts with memory-only state and BRD non-goal 10 ("does not persist session data"). Offline handling is explicitly a separate owner in 1.1, so this needs a product decision before anyone builds storage.
5. **Checkpoint screens do not follow the 1.2 / 1.3 / 1.4 checkpoint rules.**
   - They are full pages with the **bottom nav visible and apparently active**. The BRD requires a blocking surface with everything else inert.
   - The acknowledgment text varies by flow ("I reviewed the customer, labor, parts, evidence, and resolution above." and "I reviewed the scope, evidence, pricing, margin, and customer destination."). The BRD fixes one statement for every checkpoint and persona: "I have reviewed the proposed changes shown above."
   - **Technician has no Reject**, only "Back to edit" and "Approve & submit". BRD: reject is always available.
   - **Estimator has three controls** (Return to quote, Reject draft, Approve & write record). BRD: exactly two.
   - There is **no second deliberate confirmation gesture**. Approve is a single tap.
   - An **"Approval note"** text field is shown. The decision event has no note field in any contract.
   - The mobile diff (C, D) lists updates without **current vs proposed** values and has no "originating agent / triggered by" line. The estimator preview (E) does show current → proposed.
6. **Worker-facing text exposes internals.**
   - G: **"Support code NET-ER-208"** (BRD: never show codes).
   - A: **"Schema v4.8 logged"**, "Unrecognized context schema", and "Service ERP context package" (no schema versions or internal names).
   - F: "This insight uses a newer schema" (no technical wording).

### High

7. **Delay and timeout states look different from the BRD.** A shows a **partially assembled workspace** with a banner, "Continue without context", and the work list available. BRD error rows 2 and 3 say a hard timeout shows only the recovery screen with **no workspace content, navigation or zones**. The designs also add worker actions ("Continue without context") the BRD does not define. Decide which governs, then fix either the screen or the BRD. **This affects the boot screens built in Stage 1.**
8. **The "Session verified" loading screen shows the worker's name, a checklist, skeleton cards, and a bottom nav**, but the BRD loading screen is wordmark, message and progress only. (The checklist screen may be the awaitingContext phase in the SDD, which allows universal nav + skeletons. Confirm which phase it depicts.) There is **no design for the pre-session loading screen**.
9. **Writes beyond the checkpoint.** "I've arrived · Start time", "Complete safety pre-check", "Record diagnosis", "Complete repair", "Close out", "Save draft", "Save field review", "Request approval access", "Request role mapping" all imply upstream writes or requests. The canvas only has decision/audit/feedback emitters. Each of these needs a defined outbound event (`step-advance` payload and destination) or is out of scope.
10. **Derived values in the UI.** Quote totals (qty × rate, subtotal, tax, **total $543.75**), **margin 43.8% · within policy**, "Quote health", "Evidence coverage: Complete", "3 related visits / 60 days", "Late / On schedule" counts, "22 min away", and the win-rate trend are all computed values. Components must render supplied values only. "Add line" and "Edit scope" also imply editing with live recalculation. The calculation must live upstream.
11. **Estimator checkpoint "Approve & write record"** writes a quote, a work-order link, equipment history and a customer email draft in one approval. Confirm with the checkpoint owners that a four-write bundle is a single checkpoint.

### Medium

12. **Tint and text colors are not tokens.** Sampled values used in the designs but absent from the token set:
    - Warning surface `#FBF0E3`, error surface `#F9E9E6`, success surface `#E7F2E8`, checkpoint/gold surface `#F4EEE2` / `#F7EEDC`
    - Disabled fill `#E3E1DB`, borders `#D7D5CE` / `#B9B6AD`
    - Dark amber text `#7B491E`, dark gold text `#705522`
    - Insight card lavender border `#CFC5E5` and blue accent `#5B7FA6` (that is `--color-viz-3`, which 1.3 says is for charts only)
    1.3 §13.3 forbids local tokens, so these need to be added to 1.3 first.
13. **Small text uses the base semantic colors, which fail AA at body size.** Measured: amber `#B87333` is 3.37:1 on the warning surface and 3.48:1 on cream; Moss Gold `#B38A45` is 2.90:1 on cream; green `#3A7D44` on its tint is 4.35:1. (The designs use `#7B491E` for banner headings, which passes at 6.64:1, but several small labels such as "2 need attention today" and "Required" appear to use the base amber.) Re-check each when tokens are added.
14. **A monospace typeface** is used for IDs and times ("WO-48213", "10:30 AM", "SE-10492"). 1.3 allows only Inter and Inter Tight. Either add a token or use Inter with tabular numerals.
15. **Radius and shape are unspecified.** The designs use large radii (cards ≈ 16 to 24px, pills fully round) and 1.3 defines none. My placeholder radius tokens (4/8px) are wrong and need to be measured and added to 1.3.
16. **Estimator header features not in any BRD:** a notification **bell**, user **name + job title** ("Kevin Osei, Senior estimator"), an "All changes synced" pill. There is no **feedback link** in the topbar and **no AI assistant trigger or More menu** anywhere, though 1.3 §6.5 to §6.7 require both.
17. **Nav failure recovery** is drawn as a card in the content area ("Choose a safe recovery"), while the BRD places the recovery surface **in the navigation zone**.
18. **"Navigation updated" is drawn as a before/after version comparison**, which looks like documentation rather than product UI. Confirm whether any visible notice is wanted. 1.1 (missing) governs.

## 4. Gaps: things the design shows that the library or contracts don't have

**Components not in the 45-component inventory** (each needs to trace to an approved screen and be added through 1.2 governance):
Checkbox / checklist row, FilterChip (Today · 3 / Priority · 1), Accordion (collapsible job card), Avatar (initials), TextArea, PhoneInput (country + number), DataTable (sortable columns, row status), editable line-item table, SignatureCapture, notification Bell, Topbar (brand, workspace name, sync pill, user), PageHeader (eyebrow + title + date), stat tile, dismissible Banner/Notice variants, ProgressStepper segmented bar (check against WorkflowStepper), bottom-sheet.

**Inventory components that never appear in these designs** (so by the 1.2 rule they would be **deferred, not built**): ProgressRing, SLAIndicator, BarChart, LineChart, DonutChart, HealthBadge, DatePicker. This removes the whole charts chunk from the Week 9 to 12 plan. Select appears (Failure condition, Repair classification).

**Contract gaps:**
- The session and context contracts have **no display name, initials, or job title**. The UI needs "Marcus Bell / MB" and "Kevin Osei, Senior estimator".
- No contract for **workflow step events**, **drafts**, **photo/signature upload**, **"request role mapping / approval access"**, **"report registry issue"**, or **notifications**.
- "Scan" and "Notes" destinations are not in the destination catalog or any BRD.

**Missing designs:** the **login form itself**, the pre-session **loading screen**, the **workspace recovery** screen (hard timeout), the **desktop session-expired** screen, **onboarding** for either persona, tablet layouts, Settings, the More menu, the AI assistant panel, the feedback form, and the Scan and Notes screens.

**Data inconsistency across image sets:** Group C uses a "walk-in **cooler** / WIC-2 condensing unit / fan motor and capacitor / contact Dana Wu / 18 min · 7.2 mi", while B, D, F, G, E use "walk-in **freezer** / ArcticAir WIF-3 FZ-02 / DTS-44 defrost sensor / contact Nina Patel". Also "Tue, Oct 3" appears next to "Saturday, October 3". Mock fixtures should pick one scenario (recommend the freezer/FZ-02 set, used in five of the eight images).

## 5. Impact on what we've built (Stage 0 and 1)

- **Tokens:** add the tint surfaces, dark text variants, borders and radii once 1.3 is updated. Until then components can't match the designs without breaking the "no local tokens" rule.
- **Boot screens (Stage 1):** `ContextDegradedNotice`, `WorkspaceRecoveryScreen`, and the loading and expired screens follow the BRD. The designs disagree in items 3, 7 and 8 above. Don't restyle them until a decision lands.
- **Contrast gate:** add the real pairs from the designs (amber text on warning surface, green on success surface, and so on) once the tint tokens exist.
- **Fixtures:** switch the mock context to the freezer/FZ-02 scenario and add `displayName`, `initials`, `jobTitle`.
- **Plan:** drop the charts chunk from Stages 7 and 8, and add the missing-component list to the library backlog.

## 6. Resolution (decided 8 Oct 2026)

**Rule:** the BRDs and the System Design Document govern behavior, structure and contracts. The Figma designs govern look and feel, layout, iconography and copy tone **wherever they do not contradict the BRDs**. On a conflict, the BRD wins and we keep the design's visual language.

| # | Conflict | Outcome | What we still take from Figma |
|---|---|---|---|
| 1 | Nav surface color and items | **BRD.** Navigation zone is Evergreen Dark with Warm Cream labels. Technician: Dashboard / Work Orders / Assets / More (mobile) and Dashboard / Work Orders / Assets / Settings (tablet/desktop). Estimator: Dashboard / Quotes / Field Review / Settings. Label is "Dashboard", not "Home". | Icon set and glyphs, tab-bar proportions, label style, bar placement. Scan, Notes, Approvals and Customers are **not built** (not in any BRD). |
| 2 | Offline drafts and expired-session content | **BRD.** State is memory-only. Drafts survive a connection drop **within the session** only. On session expiry the canvas clears all content and shows only the expired screen. | The offline banner, "read + draft only" pill, disabled "Writes unavailable offline" button. Copy that says "saved on this device" is reworded to "kept while this page stays open". The "2 drafts preserved locally" card is dropped. |
| 3 | Checkpoint | **BRD.** Blocking overlay (everything else inert), fixed statement "I have reviewed the proposed changes shown above.", exactly two controls (approve, reject), reject always available, deliberate confirmation gesture before approve, no extra note field. | Card layout, "What will be written" rows with current → proposed, Decision summary and Accountability panels, gold approve styling, status pills. |
| 4 | Context hard timeout | **BRD.** Recovery screen only (wordmark, plain message, retry, contact support). | The partial-workspace look is used for **zone-level** failures (F: "Context section unavailable", "Still available", "Retry context section"), which the BRD allows. |
| 5 | Codes, schema versions, internal names | **BRD.** Never shown to the worker. Remove "Support code NET-ER-208", "Schema v4.8 logged", "newer schema". Customer tool names are fine only when supplied upstream as text. | Everything else in those states. |
| 6 | Derived values (totals, margin, counts) | **BRD.** Upstream supplies them. Components render only. | Layout of the quote and summary cards. |
| 7 | Tint and text colors, monospace, radii | **Added as proposals** (see tokens.json, group `proposed`), pending a 1.3 update. Monospace is **not** adopted: IDs and times use Inter with tabular numerals. Radii stay provisional until measured from Figma. | Surface tints, dark amber text, borders, insight accent. |
| 8 | Topbar | **Defined from the design** (brand mark, workspace label, sync pill, user avatar/name/role) because the BRDs reference a topbar without defining one (SDD R20/Q30). BRD additions still apply: feedback link on tablet/desktop, AI assistant trigger, More menu on mobile. Bell is not built (no BRD). | Whole visual treatment. |
| 9 | Missing components | Added to the library backlog through 1.2 governance, only for screens we actually build. | Component look. |
| 10 | Chart components, HealthBadge, DatePicker | **Deferred** (never appear in an approved screen). Charts chunk removed from the plan. | n/a |

## 7. Still open

- 1.1 and 1.4 are not in the repo. Navigation and checkpoint details remain second-hand.
- The Figma file itself is not readable (connector not authorized), so exact radii, spacing and icon choices are read from screenshots.
- Product: onboarding behavior, login screen (no design exists), and the "request role mapping / request approval access / report registry issue" actions need destinations.
