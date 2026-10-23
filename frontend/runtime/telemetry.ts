// Structured telemetry (SDD section 16). Fields are enumerated and typed: no free-form strings, so a credential
// or personal identifier cannot be logged by accident (BRD 1.0 SR23B). Audit stubs are a different channel.
// The sink is replaceable: the log channel is OPEN (BRD 1.0 OQ6), so call sites never change when it is chosen.

import type { TerminalOutcome } from '@/contracts';
import { registerPurgeHandler } from './purgeSession';

export type EventName =
  | 'session.slow'
  | 'session.expired'
  | 'context.delivery_degraded'
  | 'context.hard_timeout'
  | 'context.schema_mismatch'
  | 'context.envelope_malformed'
  | 'layout.unmapped_role'
  | 'layout.role_undetermined'
  | 'auth.sign_in_failed'
  | 'auth.sign_up_failed'
  | 'auth.sign_up_submitted'
  | 'auth.throttled'
  | 'auth.validation_failed'
  | 'config.invalid'
  | 'zone.unavailable'
  | 'zone.refresh_delayed'
  | 'refresh.auto'
  | 'bus.disconnected'
  | 'bus.reconnected'
  | 'bus.reconnect_failed'
  | 'bus.event_invalid'
  | 'bus.event_dropped'
  | 'history.unavailable'
  | 'widget.unsupported'
  | 'widget.invalid'
  | 'widget.render_error'
  | 'feedback.submitted'
  | 'feedback.failed'
  | 'zone.payload_malformed'
  | 'nav.unknown_destination'
  | 'nav.duplicate_destination'
  | 'nav.layout_degraded'
  | 'nav.catalog_unavailable'
  | 'nav.destination_invalid'
  | 'nav.component_failure'
  | 'nav.offline_unavailable_selected'
  | 'checkpoint.shown'
  | 'checkpoint.protocol_error'
  | 'checkpoint.second_trigger_rejected'
  | `checkpoint.${TerminalOutcome}`;

export type Severity = 'info' | 'warn' | 'error';

/** Enumerated reason codes. Add a literal here rather than passing a string. */
export type EventDetail = 'invalid_credentials' | 'locked' | 'unavailable' | 'network' | 'schema_version' | 'malformed' | 'render_error' | 'rate_limited' | 'rejected' | 'duplicate';

export interface TelemetryEvent {
  event: EventName;
  severity: Severity;
  ts: number;
  detail?: EventDetail;
}

export type TelemetrySink = (events: readonly TelemetryEvent[]) => void;

const BUFFER_MAX = 200;
let buffer: TelemetryEvent[] = [];
let sink: TelemetrySink | null = null;

export function setTelemetrySink(next: TelemetrySink | null): void {
  sink = next;
}

export function logEvent(event: EventName, severity: Severity, detail?: EventDetail): void {
  const entry: TelemetryEvent = { event, severity, ts: Date.now(), ...(detail ? { detail } : {}) };
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer = buffer.slice(buffer.length - BUFFER_MAX);
  sink?.([entry]);
}

export function getBufferedEvents(): readonly TelemetryEvent[] {
  return buffer;
}

/** Drops buffered events. Called by purgeSession so nothing from an ended session survives. */
export function clearTelemetryBuffer(): void {
  buffer = [];
}

// Nothing from an ended session may survive in the browser (BRD 1.0 error row 12).
registerPurgeHandler(clearTelemetryBuffer);
