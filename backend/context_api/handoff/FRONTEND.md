# Canvas integration guide

You are building the canvas. This API gives you everything it renders. You never call a source system.

The contract follows the Canvas Shell BRD (V3, Oct 10 2026). Where the BRD is silent or still open, this guide says so.

## 0. Read this first: pull endpoints are a dev stand-in for push

In production the PCR **delivers** the context object to the canvas, and the Streaming Canvas Aggregator **delivers** history. The canvas never calls the PCR (Non-Goal 4) and never fetches history (Non-Goal 6, User Requirement 9C: a code review audit fails any direct history call from the shell).

These `GET` endpoints exist so you can start before that delivery exists. Use them like this:

- Put every `fetch` in **one dev-only delivery module** outside the shell (for example `devDelivery.ts`). It calls the API and hands the shell finished objects, the same way the real delivery will.
- The shell and its components only ever receive objects. They contain no `fetch` to these URLs.
- When the real delivery exists, you replace that one module. The payload shape stays the same.

The auth headers below are also a stand-in. The BRD has Identity and Access hand the canvas a session payload (`user_id`, `resolved_role`, `tenant_id`, `session_token`, `session_id`) and the canvas does no authentication.

## 1. Connect

| | |
|---|---|
| Base URL (local) | `http://localhost:8000` |
| Auth headers (dev stand-in, required on every `/v1/sessions/...` call) | `Authorization: Bearer <any token in the mock>` and `X-Tenant-Id: <any>` |
| CORS | `http://localhost:3000` is allowed by default |
| Types | `npx openapi-typescript handoff/openapi.json -o src/types/olannah.d.ts` |
| Mock session ids | `s_8f2` (Marcus, main scenario), `s_clear` (all empty), `s_busy` (lots of data, `done` steps), `s_nojob` (no active work order), `s_unmapped` (role has no layout), anything else is a 404 (role cannot be determined) |

## 2. The two deliveries

```
GET /v1/sessions/{session_id}/context            -> ContextObject   (once, after login)
GET /v1/sessions/{session_id}/history/{pointer}  -> HistoryMessage  (once per pointer, delivered after the main workspace)
```

Sequence:

1. Context arrives. Load the layout template named by `layout_config.template_id`. Render every zone.
2. A zone with `state: "loading"` shows its skeleton. Today only `zones.history` arrives that way (User Requirement 9A).
3. Take `zones.history.pointer` and let the delivery module fetch `history/{pointer}`. Fill the history zone from `data`. If the pointer is `null` there is nothing to load (the worker has no active job).

Never construct or edit a pointer yourself. Treat it as an opaque string. Never modify the context object after receipt (System Requirement 16C).

## 3. Zone states

The API sends three states (BRD System Requirement 16A):

| `state` | Render |
|---|---|
| `loading` | The zone's skeleton |
| `rendered` | The component with `data`. If `data` is empty, show the zone's empty state with a plain-language reason. An empty state is **not** an error (BRD section 6). |
| `unavailable` | The zone's own plain-language "unavailable" message. `data` is empty. Other zones keep working. |

**`stale` is yours, not the API's.** The BRD defines the staleness indicator as "a refresh is in progress", and it turns into a warning if the refresh takes longer than 30 seconds. The canvas derives that from its own refresh timing, so the API never sends `stale`. If you receive it, treat the payload as malformed.

**How old is the data?** Use `zones.*.as_of` and `connection_status[].last_synced`. For example, the main scenario's work order has `as_of` about 15 hours before `delivered_at`, because Xtreme last synced the evening before. Show the timestamp. Do not decide what counts as too old.

Every zone needs an unavailable message before it can ship (User Requirement 5A). Write them in your zone registry.

## 4. Top-level fields

| Field | Use |
|---|---|
| `schema_version` | Current: `"1.0"`. If you do not recognize it, show the recoverable fallback state and emit a structured error event (System Requirement 20). |
| `resolved_role` | The worker's primary role id (for example `technician`). The API also sends a display name in `worker.role_label`. Where the role finally lives (session or context) is BRD open question 1. |
| `layout_config` | `template_id` picks the layout template. `destinations` is the ordered list of **role-based** navigation destination ids. The universal destinations (Dashboard, More, Settings) are the shell's and are never in this list (System Requirement 24). |
| `active_work_order` | Non-null: show the Context Header. Null: hide it (System Requirement 26A and 26E). |
| `connection_status[]` | `state` is `live`, `read_only` or `down`. Drives connectivity banners. `write_back: false` means actions are manual steps. |
| `degraded_fields[]` | `{field, reason}`. `unmapped_role` on `layout` means load the platform default layout (User Requirement 3C: read the flag, never infer it from missing data). `source.<system>` means that system is down. `delivery` / `budget_exceeded` means the context took longer than the 800 ms budget but did arrive. |

## 5. Suggested zone to component mapping (the layout template is yours to define)

| Zone id | Data shape | Suggested component |
|---|---|---|
| `alerts` | `Alert[]` (severity, message, suggestion, evidence) | AlertList |
| `work_order` | `Entity` (title, label/value fields) | EntityCard |
| `steps` | `Step[]` (kind: confirm, photo, question, guide; status: todo, current, done) | WorkflowStepper |
| `actions` | `Action[]` (enabled, write_back, needs_checkpoint) | ActionPanel |
| `history` | `Record[]` (date, title, status, flags, sources) | RecordTimeline |

The zone ids above are a proposal. The BRD leaves the zone model to a child document (1.2), so confirm them there.

**`needs_checkpoint` is information, not a trigger.** The canvas never decides when an approval screen appears (Non-Goal 3, User Requirement 13C). Show the approval screen only when the checkpoint protocol tells you to. The trigger contract is still open (BRD open question 3). You may use the flag for an affordance such as "this action will ask for approval". `enabled` is resolved upstream, so render it as given and do not add your own permission logic (System Requirement 23C).

## 6. Test every state without waiting for outages

Real responses are in `handoff/examples/`:

| File | Scenario |
|---|---|
| `context.happy.json` | Everything works. The work order's `as_of` is about 15 hours old. |
| `context.sitedocs-down.json` | Safety alerts and steps vanish, rest unaffected |
| `context.sitedocs-and-xoi-down.json` | `steps` zone is `unavailable` |
| `context.portal-login-wall.json` | Portal down, no SLA field |
| `context.sampro-down.json` | System of record down: no work order, most zones `unavailable` |
| `context.unmapped-role.json` | Platform default layout plus an `unmapped_role` flag |
| `context.clear.json` | Healthy job with no alerts, no steps and no history: test every empty state |
| `context.busy.json` | 10 alerts, 19 steps including `done`, long labels, SLA row |
| `context.busy-xoi-down.json` | Same job with XOi down: `steps` falls back to the safety-document steps only |
| `context.no-active-job.json` | No active work order: null header, all zones `rendered` and empty, null history pointer |
| `context.over-budget.json` | Delivered after the 800 ms budget: still a normal context, plus a `delivery` / `budget_exceeded` degraded field |
| `context.bad-schema.json` | `schema_version` is `9.9`: test the version-mismatch fallback (System Requirement 20) |
| `context.malformed-zone.json` | `zones.alerts.data` is a string: that zone only becomes unavailable (System Requirement 21A) |
| `context.malformed-envelope.json` | `zones` is a string: whole-workspace fallback (System Requirement 21B) |
| `history.happy.json` / `history.drive-down.json` | Merged history, and history with one source missing |
| `history.clear.json` / `history.busy.json` | Empty history (`data: []`, still `rendered`), and a 28-record history with duplicates absorbed |
| `history.malformed-zone.json` | History `data` is a string |

With the server started using `OLANNAH_DEV=1` you can flip problems live:

```bash
# a source system fails
curl -X POST localhost:8000/v1/dev/faults -H 'content-type: application/json' -d '{"sitedocs":"down"}'
curl -X DELETE localhost:8000/v1/dev/faults

# the delivery itself misbehaves
curl -X POST localhost:8000/v1/dev/delivery -H 'content-type: application/json' -d '{"delay_seconds": 2}'
curl -X POST localhost:8000/v1/dev/delivery -H 'content-type: application/json' -d '{"payload": "bad_schema"}'
curl -X DELETE localhost:8000/v1/dev/delivery    # back to normal
```

- Source systems: `sampro`, `xtreme`, `xoi`, `sitedocs`, `shared_drive`, `client_portal`. Modes: `down`, `slow` (that source times out), `login_wall` (portal only).
- `delay_seconds` slows the whole context delivery. Past 0.8 s it is flagged but still delivered. Past 10 s the API answers 504, so you can test your recovery screen.
- `payload` is `bad_schema`, `malformed_zone` or `malformed_envelope`. Each is applied to the next deliveries until you `DELETE`.

## 7. Minimal delivery module (illustrative)

```ts
// devDelivery.ts: the ONLY place that knows these URLs. The shell never imports it.
import type { components } from "./types/olannah";
type ContextObject = components["schemas"]["ContextObject"];
type HistoryMessage = components["schemas"]["HistoryMessage"];

const headers = { Authorization: "Bearer dev", "X-Tenant-Id": "t_acme_hvac" };
const base = "http://localhost:8000/v1/sessions/s_8f2";

export async function deliverContext(): Promise<unknown> {
  const res = await fetch(`${base}/context`, { headers });
  if (!res.ok) throw new Error(`delivery failed: ${res.status}`); // 504: the hard timeout, show the recovery screen
  return res.json(); // hand over as-is. Validate in the shell: it must survive bad payloads.
}

export async function deliverHistory(pointer: string): Promise<unknown> {
  const res = await fetch(`${base}/history/${pointer}`, { headers });
  return res.json();
}
```

## 8. Error responses

| Status | Meaning | Canvas shows |
|---|---|---|
| 401 | Session not confirmed (dev stand-in for the SSO session) | Loading screen. Never render the workspace before login is confirmed (User Requirement 1). |
| 404 | The worker's role cannot be determined | The fallback screen, no layout template (User Requirement 3D). Different from an unmapped role, which is a 200 with a flag. |
| 504 | No context within the 10 s hard timeout (Performance Target 16) | The workspace recovery screen, and a structured timeout event. |

A context that arrives after 800 ms but before 10 s is a normal 200 with the `delivery` flag. Show your recoverable loading state while you wait, never an error (User Requirement 10).

## 9. What this API does not do yet

- No Shared Context Bus events, no 5-minute refresh, and so no way to test the refreshing indicator or its 30-second warning.
- No writes (BRD open question 13), no checkpoint triggers (open question 3), no access-revocation signal (open question 11).
- No real auth, and one persona (technician).
- The history `seq` counts deliveries per session. Whether sequence numbers are per tenant, per session or global is BRD open question 4, so treat this as a placeholder.

The contract is versioned by `schema_version`. The BRD requires five business days' notice before a breaking change.
