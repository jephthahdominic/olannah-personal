# Olannah sample data (all FICTIONAL)

Scenario: Marcus Allen (technician T0042) marks himself on site at Store 118 for the Northfield Grocers compressor job on 2026-10-23, 08:00.

| File | Mock of | Style | How it identifies the job |
|---|---|---|---|
| `sampro-mock.json` | Sampro (system of record; also van inventory, an assumption) | terse legacy fields, YYYYMMDD | `wo_no` 4471 |
| `xtreme.json` | Xtreme (work orders) | camelCase, ISO-8601 | `jobId` JOB-2026-004471, `externalRef` "4471" (may be null) |
| `xoi.json` | XOi (client workflows) | snake_case steps | customer NAME only (case varies) |
| `sitedocs.json` | SiteDocs (safety) | US dates MM/DD/YYYY | site NAME only (format varies) |
| `shared-drive-history.csv` | Shared-drive history spreadsheet | messy CSV | equipment id typed 4 different ways |
| `client-portal.json` | Northfield vendor portal | read-only | ticket NG-T-220931 + PO |

## Crosswalk (what the PCR/adapters must correlate)

- Job: Sampro `4471` = Xtreme `JOB-2026-004471` = portal ticket `NG-T-220931` via PO `NG-PO-88217`.
- Customer: `C1180` (Sampro, Xtreme) = "NORTHFIELD GROCERS" / "Northfield Grocers" (XOi, free text).
- Site: `S0118` = "Store 118" = "STORE 118" = "store #118" = portal store "118".
- Equipment: `E-2231` = `E2231` = `e-2231`.

## Cross-system facts the canvas should end up showing

1. History conflict: Sampro has the 2026-08-14 valve replacement (svc 8841). The shared drive does NOT. The shared drive has an extra 2024-02-09 fan motor job that Sampro lacks. Merged history should include all, deduplicated (2026-03-02 appears in both, plus a duplicate row in the CSV).
2. Recurring failure: two failures in 12 months (2026-03-02, 2026-08-14), so a "failed twice" alert.
3. Parts alert: V-221 is 0 in van, V-224 is 2 and worked at Store 204 on 2026-09-18.
4. Safety: the Store 118 JSA is EXPIRED, so it must be redone on arrival. Lockout/Tagout verification is required before work. His Lockout cert expires in 10 days (info alert). The expired Confined Space cert is not relevant to this job and should not alert.
5. Client SLA: respond by 2026-10-23 12:00, resolve by 2026-10-24 08:00. Close-out needs photos, manager signature and the refrigerant log.
6. Freshness: Xtreme data was last synced 2026-10-22 16:40, so the work-order zone should show it as not live.
7. Write-back: no system supports it, so Action Panel actions must show `write_back: manual`.

## Failure drills (each system file has a `system_unavailable` case)

Take down one system at a time and check that only the zones depending on it become unavailable. A hard 200-with-HTML login page from the portal must also count as unavailable.
