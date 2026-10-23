import { validateContext, type ContextEnvelope } from '@/contracts';
import type { SessionIdentity } from '@/clients/session/sessionClient';
import { deepFreeze, type DeepReadonly } from '../freeze';
import { resolveLayout, type ResolvedLayout } from './layoutRegistry';
import type { EventDetail, EventName, Severity } from '../telemetry';

// Boot is an explicit finite state machine (SDD 5.3). Every state has exactly one rendering outcome, so the canvas
// can never show an undefined screen. This file is a pure reducer: no timers, no network, trivially testable.

export type BootState =
  | { phase: 'awaitingSession'; slow: boolean }
  | { phase: 'noSession' }
  | { phase: 'awaitingContext'; session: SessionIdentity }
  | { phase: 'contextDegraded'; session: SessionIdentity }
  | { phase: 'contextHardTimeout'; session: SessionIdentity }
  | { phase: 'assembled'; session: SessionIdentity; context: DeepReadonly<ContextEnvelope>; layout: ResolvedLayout }
  | { phase: 'settled'; session: SessionIdentity; context: DeepReadonly<ContextEnvelope>; layout: ResolvedLayout }
  | { phase: 'fallbackUnknownRole'; session: SessionIdentity }
  | { phase: 'fallbackSchema'; session: SessionIdentity }
  | { phase: 'fallbackMalformed'; session: SessionIdentity }
  | { phase: 'sessionExpired' };

export type BootPhase = BootState['phase'];

export type BootEvent =
  | { type: 'SESSION_SLOW' }
  | { type: 'SESSION_CONFIRMED'; session: SessionIdentity }
  | { type: 'NO_SESSION' }
  | { type: 'CONTEXT_RECEIVED'; raw: unknown }
  | { type: 'DELIVERY_BUDGET_EXCEEDED' }
  | { type: 'HARD_TIMEOUT' }
  | { type: 'CONTEXT_SETTLED' }
  | { type: 'RETRY' }
  | { type: 'SESSION_EXPIRED' };

export interface LogRequest {
  event: EventName;
  severity: Severity;
  detail?: EventDetail;
}

export interface Transition {
  state: BootState;
  log: LogRequest[];
}

export const initialBootState: BootState = { phase: 'awaitingSession', slow: false };

const stay = (state: BootState): Transition => ({ state, log: [] });

function receiveContext(session: SessionIdentity, raw: unknown): Transition {
  const result = validateContext(raw);

  if (result.kind === 'schema_mismatch') {
    return {
      state: { phase: 'fallbackSchema', session },
      log: [{ event: 'context.schema_mismatch', severity: 'error', detail: 'schema_version' }],
    };
  }
  if (result.kind === 'envelope_malformed') {
    return {
      state: { phase: 'fallbackMalformed', session },
      log: [{ event: 'context.envelope_malformed', severity: 'error', detail: 'malformed' }],
    };
  }

  // Validated, then deep-frozen at ingestion so mutation is impossible (BRD 1.0 SR16C).
  const context = deepFreeze(result.context);
  const resolution = resolveLayout(context);

  if (resolution.kind === 'role_undetermined') {
    return {
      state: { phase: 'fallbackUnknownRole', session },
      log: [{ event: 'layout.role_undetermined', severity: 'warn' }],
    };
  }
  return {
    state: { phase: 'assembled', session, context, layout: resolution.layout },
    log: resolution.layout.unmappedRole ? [{ event: 'layout.unmapped_role', severity: 'warn' }] : [],
  };
}

export function reduceBoot(state: BootState, event: BootEvent): Transition {
  // Session expiry ends everything, from any state that has or awaits a session.
  if (event.type === 'SESSION_EXPIRED') {
    if (state.phase === 'sessionExpired' || state.phase === 'noSession') return stay(state);
    return { state: { phase: 'sessionExpired' }, log: [{ event: 'session.expired', severity: 'info' }] };
  }

  switch (state.phase) {
    case 'awaitingSession':
      if (event.type === 'SESSION_SLOW' && !state.slow) {
        return { state: { phase: 'awaitingSession', slow: true }, log: [{ event: 'session.slow', severity: 'warn' }] };
      }
      if (event.type === 'SESSION_CONFIRMED') return stay({ phase: 'awaitingContext', session: event.session });
      if (event.type === 'NO_SESSION') return stay({ phase: 'noSession' });
      return stay(state);

    case 'awaitingContext':
      if (event.type === 'CONTEXT_RECEIVED') return receiveContext(state.session, event.raw);
      if (event.type === 'DELIVERY_BUDGET_EXCEEDED') {
        return {
          state: { phase: 'contextDegraded', session: state.session },
          log: [{ event: 'context.delivery_degraded', severity: 'warn' }],
        };
      }
      if (event.type === 'HARD_TIMEOUT') return hardTimeout(state.session);
      return stay(state);

    case 'contextDegraded':
      if (event.type === 'CONTEXT_RECEIVED') return receiveContext(state.session, event.raw);
      if (event.type === 'HARD_TIMEOUT') return hardTimeout(state.session);
      return stay(state);

    case 'assembled':
      if (event.type === 'CONTEXT_SETTLED') {
        return stay({ phase: 'settled', session: state.session, context: state.context, layout: state.layout });
      }
      return stay(state);

    case 'contextHardTimeout':
    case 'fallbackSchema':
    case 'fallbackMalformed':
    case 'fallbackUnknownRole':
      if (event.type === 'RETRY') return stay({ phase: 'awaitingContext', session: state.session });
      return stay(state);

    default:
      return stay(state);
  }
}

function hardTimeout(session: SessionIdentity): Transition {
  return {
    state: { phase: 'contextHardTimeout', session },
    log: [{ event: 'context.hard_timeout', severity: 'error' }],
  };
}
