import { AssistantFrameSchema, OutboundMessageSchema, type AssistantTurn, type RuntimeConfig } from '@/contracts';
import { BusConnection, type BusState, type SourceFactory } from '@/clients/bus/busConnection';
import { newId } from '../ids';
import { logEvent } from '../telemetry';

// The assistant session lives in the RUNTIME, not in the panel (SDD 7.10, BRD 1.2 5.10): the panel renders turns and emits
// authored text upward; it never calls the intelligence layer, owns the connection, or holds the conversation as
// authoritative. This holds a RENDER-ONLY cache of the turns seen on the socket.
//
// The assistant is bidirectional and PROACTIVE (BRD 1.0 OQ9): it can speak first, from live worker activity. A proactive
// message while the panel is closed is counted as unread so the trigger can say so. It is never a modal interruption.

export type AssistantStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type SubmitResult = { ok: true } | { ok: false; reason: 'invalid' | 'disconnected' };

export interface AssistantState {
  readonly turns: readonly AssistantTurn[];
  readonly status: AssistantStatus;
  /** Proactive assistant messages that arrived while the panel was closed. */
  readonly unread: number;
}

const MAX_TURNS = 200;

export class AssistantSession {
  #state: AssistantState = { turns: [], status: 'connecting', unread: 0 };
  #listeners = new Set<() => void>();
  #conn: BusConnection | null = null;
  #open = false;

  constructor(
    private readonly createSource: SourceFactory,
    private readonly bus: RuntimeConfig['bus'],
    private readonly random?: () => number,
  ) {}

  subscribe = (l: () => void): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): AssistantState => this.#state;

  start(): void {
    this.#conn?.close();
    this.#conn = new BusConnection(this.createSource, { ...this.bus, random: this.random }, { onEvent: (d) => this.#onFrame(d), onState: (s) => this.#onState(s) });
    this.#conn.start();
  }

  /** The shell tells the session whether the panel is open. Opening clears the unread count. */
  setOpen(open: boolean): void {
    this.#open = open;
    if (open && this.#state.unread > 0) this.#set({ ...this.#state, unread: 0 });
  }

  /**
   * The worker's authored text goes OUT over the socket. If the connection is not live nothing is sent and nothing is queued,
   * so the panel can say so honestly instead of showing a message that never left.
   */
  submit(text: string): SubmitResult {
    const parsed = OutboundMessageSchema.safeParse({ type: 'user_message', id: newId('u'), text });
    if (!parsed.success) return { ok: false, reason: 'invalid' };
    if (!this.#conn?.send(JSON.stringify(parsed.data))) return { ok: false, reason: 'disconnected' };
    this.#append({ id: parsed.data.id, role: 'user', text: parsed.data.text });
    return { ok: true };
  }

  retry(): void {
    this.#conn?.retry();
  }

  /** Stops the connection. The cached turns are dropped: nothing from the session may outlive it. */
  dispose(): void {
    this.#conn?.close();
    this.#conn = null;
    this.#set({ turns: [], status: 'connecting', unread: 0 });
  }

  #onFrame(data: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      return void logEvent('bus.event_invalid', 'warn', 'malformed');
    }
    const parsed = AssistantFrameSchema.safeParse(raw);
    // A frame the canvas does not understand is dropped, never rendered as a guess.
    if (!parsed.success) return void logEvent('bus.event_invalid', 'warn', 'malformed');
    const turn = parsed.data.turn;
    if (this.#state.turns.some((t) => t.id === turn.id)) return; // idempotent: a replayed frame changes nothing
    this.#append(turn);
    if (turn.proactive && turn.role === 'assistant' && !this.#open) this.#set({ ...this.#state, unread: this.#state.unread + 1 });
  }

  #onState(state: BusState): void {
    this.#set({ ...this.#state, status: state });
  }

  #append(turn: AssistantTurn): void {
    const turns = [...this.#state.turns, turn].slice(-MAX_TURNS);
    this.#set({ ...this.#state, turns });
  }

  #set(next: AssistantState): void {
    this.#state = next;
    for (const l of [...this.#listeners]) l();
  }
}
