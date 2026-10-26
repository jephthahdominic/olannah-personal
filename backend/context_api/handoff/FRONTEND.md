# Canvas integration guide

You are building the canvas. This API gives you everything it renders. You never call a source system.

## 1. Connect

| | |
|---|---|
| Base URL (local) | `http://localhost:8000` |
| Auth headers (required on every `/v1/sessions/...` call) | `Authorization: Bearer <any token in the mock>` and `X-Tenant-Id: <any>` |
| CORS | `http://localhost:3000` is allowed by default |
| Types | `npx openapi-typescript handoff/openapi.json -o src/types/olannah.d.ts` |
| Mock session ids | `s_8f2` (Marcus, main scenario), `s_unmapped` (no layout for the role), anything else is a 404 |

## 2. The two calls

```
GET /v1/sessions/{session_id}/context            -> ContextObject   (call once, after login)
GET /v1/sessions/{session_id}/history/{pointer}  -> HistoryMessage  (call once per pointer you receive)
```

Sequence:

1. `GET context`. Pick your layout template from `layout.template_id`. Render every zone.
2. A zone with `state: "loading"` shows a skeleton. Today only `zones.history` arrives that way.
3. Take `zones.history.pointer` and `GET history/{pointer}`. Fill the history zone from `data`.

Never construct or edit a pointer yourself. Treat it as an opaque string.

## 3. Zone states: what to render

| `state` | Render |
|---|---|
| `loading` | The zone's skeleton |
| `ready` | The component with `data` |
| `stale` | The component with `data` **plus** a visible "as of `as_of`" indicator (the data is old, not wrong) |
| `unavailable` | The zone's own plain-language "unavailable" message. `data` is empty. Other zones keep working. |

Every zone needs an unavailable message before it can ship (BRD requirement). Write them in your zone registry.

## 4. Other top-level fields

| Field | Use |
|---|---|
| `schema_version` | If you do not recognize it, show the recoverable fallback screen. Current: `"1.0"`. |
| `active_work_order` | Non-null: show the Context Header. Null: hide it. |
| `connection_status[]` | `state` is `live`, `read_only` or `down`. Drive banners. `write_back: false` means actions are manual steps. |
| `degraded_fields[]` | `{field, reason}`. `reason: "unmapped_role"` means the platform default layout was chosen. `field: "source.<system>"` means that system is down. |
| `layout.destinations` | Ordered nav destination ids for this role. |

## 5. Suggested zone to component mapping (the layout template is yours to define)

| Zone id | Data shape | Suggested component |
|---|---|---|
| `alerts` | `Alert[]` (severity, message, suggestion, evidence) | AlertList |
| `work_order` | `Entity` (title, label/value fields) | EntityCard |
| `steps` | `Step[]` (kind: confirm, photo, question, guide) | WorkflowStepper |
| `actions` | `Action[]` (enabled, write_back, needs_checkpoint) | ActionPanel |
| `history` | `Record[]` (date, title, status, flags, sources) | RecordTimeline |

`needs_checkpoint: true` means show your approval screen before the write. This API does not accept
writes yet.

## 6. Test every state without waiting for outages

Real responses for each state are in `handoff/examples/`:

| File | Scenario |
|---|---|
| `context.happy.json` | Everything works |
| `context.sitedocs-down.json` | Safety alerts and steps vanish, rest unaffected |
| `context.sitedocs-and-xoi-down.json` | `steps` zone is `unavailable` |
| `context.portal-login-wall.json` | Portal down, no SLA field |
| `context.sampro-down.json` | System of record down: no work order, most zones `unavailable` |
| `context.unmapped-role.json` | Platform default layout plus an `unmapped_role` flag |
| `history.happy.json` / `history.drive-down.json` | Merged history, and history with one source missing |

With the server started using `OLANNAH_DEV=1` you can flip faults live:

```bash
curl -X POST localhost:8000/v1/dev/faults -H 'content-type: application/json' -d '{"sitedocs":"down"}'
curl -X DELETE localhost:8000/v1/dev/faults      # clear them all
```

Systems: `sampro`, `xtreme`, `xoi`, `sitedocs`, `shared_drive`, `client_portal`.
Modes: `down`, `slow` (times out), `login_wall` (portal only).

## 7. Minimal fetch example (illustrative)

```ts
import type { components } from "./types/olannah";
type ContextObject = components["schemas"]["ContextObject"];
type HistoryMessage = components["schemas"]["HistoryMessage"];

const headers = { Authorization: "Bearer dev", "X-Tenant-Id": "t_acme_hvac" };
const base = "http://localhost:8000/v1/sessions/s_8f2";

export async function loadWorkspace() {
  const res = await fetch(`${base}/context`, { headers });
  if (!res.ok) throw new Error(`context failed: ${res.status}`); // 401, 404 or 504: show the recovery screen
  const context: ContextObject = await res.json();

  const pointer = context.zones.history.pointer;
  const history: Promise<HistoryMessage> | null = pointer
    ? fetch(`${base}/history/${pointer}`, { headers }).then((r) => r.json())
    : null;

  return { context, history }; // render `context` now, fill the history zone when `history` resolves
}
```

## 8. Error responses

| Status | Meaning | Canvas shows |
|---|---|---|
| 401 | Session not confirmed | Session loading or expired screen |
| 404 | Session or role cannot be determined | Fallback screen |
| 504 | Context took longer than 800 ms | Recoverable loading state, then recovery screen |

## 9. What this API does not do yet

No writes (the BRD's open question 13), no live push (Shared Context Bus), no real auth, and one
persona (technician). The contract is versioned by `schema_version`; breaking changes bump it.
