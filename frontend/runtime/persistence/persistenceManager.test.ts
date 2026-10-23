import { describe, it, expect } from 'vitest';
import { PersistenceManager } from './persistenceManager';

// BRD 1.0 SR17, BRD 1.2 5.4, SDD 7.9: the SHELL decides persistence; a component only declares capability.
describe('PersistenceManager', () => {
  it('persists only a component that is both capable AND elected by the shell', () => {
    const m = new PersistenceManager(['AssistantPanel']);
    expect(m.isElected('AssistantPanel', true)).toBe(true);
    expect(m.isElected('AssistantPanel', false)).toBe(false); // elected but not capable
    expect(m.isElected('Button', true)).toBe(false); // capable but not elected
    expect(m.isElected('WorkflowStepper', true)).toBe(false);
  });

  it('the same component is ephemeral in one composition and persisted in another, decided only by configuration', () => {
    const persisted = new PersistenceManager(['AssistantPanel']);
    const ephemeral = new PersistenceManager([]);
    expect(persisted.isElected('AssistantPanel', true)).toBe(true);
    expect(ephemeral.isElected('AssistantPanel', true)).toBe(false);
  });

  it('keeps a continuity snapshot (scroll position only) and hands it back once', () => {
    const m = new PersistenceManager(['AssistantPanel']);
    m.save('AssistantPanel', { scrollTop: 123.7 });
    expect(m.take('AssistantPanel')).toEqual({ scrollTop: 124 });
    expect(m.take('AssistantPanel')).toBeNull();
  });

  it('never stores a negative scroll position', () => {
    const m = new PersistenceManager([]);
    m.save('X', { scrollTop: -50 });
    expect(m.take('X')).toEqual({ scrollTop: 0 });
  });

  it('holds only continuity: the snapshot has no authoritative or business fields', () => {
    const m = new PersistenceManager(['AssistantPanel']);
    m.save('AssistantPanel', { scrollTop: 5, conversation: [{ text: 'secret' }] } as never);
    expect(Object.keys(m.take('AssistantPanel')!)).toEqual(['scrollTop']);
  });

  it('clear drops everything', () => {
    const m = new PersistenceManager([]);
    m.save('X', { scrollTop: 1 });
    m.clear();
    expect(m.take('X')).toBeNull();
  });
});
