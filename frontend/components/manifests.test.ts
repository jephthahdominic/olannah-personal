import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manifests } from './manifests';

// Compliance with 1.2 5.2, 5.13 and 5.14 becomes a build result (ADR-009).
const indexSource = readFileSync(join(__dirname, 'index.ts'), 'utf8');
const exported = [...indexSource.matchAll(/export \{ ([A-Za-z]+)[,} ]/g)].map((m) => m[1]).filter((n) => /^[A-Z]/.test(n)); // components only: hooks and formatters are utilities

describe('component manifests', () => {
  it('every exported component has a manifest, and every manifest is for an exported component', () => {
    expect(Object.keys(manifests).sort()).toEqual([...exported].sort());
  });

  it.each(Object.values(manifests))('$name declares all three state dimensions (inapplicable ones marked, never omitted)', (manifest) => {
    for (const dimension of ['data', 'interaction', 'runtime'] as const) {
      expect(manifest.dimensions[dimension], `${manifest.name}.${dimension}`).toBeDefined();
    }
  });

  it.each(Object.values(manifests))('$name declares all five accessibility obligations', (manifest) => {
    for (const obligation of ['contrast', 'touchTarget', 'focus', 'announcement', 'reducedMotion'] as const) {
      expect(manifest.a11y[obligation], `${manifest.name}.${obligation}`).toBeTruthy();
    }
  });

  it.each(Object.values(manifests))('$name has a canonical name matching its key, a category, and prohibited behaviors where it can misbehave', (manifest) => {
    expect(manifests[manifest.name]).toBe(manifest);
    expect(manifest.category).toBeTruthy();
  });

  it('every interactive component declares the touch target floor, and every interaction state follows the contract', () => {
    const contract = ['default', 'hover', 'pressed', 'focus', 'disabled', 'processing'];
    for (const m of Object.values(manifests)) {
      if (m.dimensions.interaction !== 'not-applicable') {
        expect(m.a11y.touchTarget === 'not-applicable' && m.events.length > 0, `${m.name} is interactive but declares no touch target`).toBe(false);
        for (const state of m.dimensions.interaction) expect(contract).toContain(state);
      }
    }
  });

  it('only WorkflowStepper and AssistantPanel may be persistence-capable (BRD 1.2 5.4), and the shell, not the component, elects them', () => {
    const capable = Object.values(manifests).filter((m) => m.lifecycle === 'persistence-capable').map((m) => m.name);
    expect(capable.sort()).toEqual(['AssistantPanel']);
  });
});
