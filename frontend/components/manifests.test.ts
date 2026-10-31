import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { manifests, proposedManifests, isSpecified } from './manifests';

// Compliance with 1.2 5.2, 5.13 and 5.14 becomes a build result (ADR-009).
const indexSource = readFileSync(join(__dirname, 'index.ts'), 'utf8');
const checkpointSource = readFileSync(join(__dirname, 'checkpoint/index.ts'), 'utf8');
const visualizationSource = readFileSync(join(__dirname, 'visualization/index.ts'), 'utf8');
const exported = [...(indexSource + checkpointSource + visualizationSource).matchAll(/export \{ ([A-Za-z]+)[,} ]/g)].map((m) => m[1]).filter((n) => /^[A-Z]/.test(n)); // components only: hooks and formatters are utilities

describe('component manifests', () => {
  it('every exported component has a manifest, and every manifest is for an exported component', () => {
    expect([...Object.keys(manifests), ...Object.keys(proposedManifests)].sort()).toEqual([...exported].sort());
    for (const name of Object.keys(proposedManifests)) expect(manifests[name], `${name} is proposed and must stay out of the library`).toBeUndefined();
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
    expect(capable.sort()).toEqual(['AssistantPanel', 'WorkflowStepper']);
  });
});

// ---- The specification: jobs, data contract and governance (BRD 1.2 5.3, 5.5.1 onward) ----

// Every manifest file on disk, so a component cannot have a manifest that the library, the gallery and these tests never see.
function manifestFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return manifestFiles(path);
    return entry.endsWith('.manifest.ts') ? [entry.replace('.manifest.ts', '')] : [];
  });
}

describe('manifest files', () => {
  it('every Component.manifest.ts on disk is registered in manifests.ts, and every registered one has a file', () => {
    expect(manifestFiles(__dirname).sort()).toEqual([...Object.keys(manifests), ...Object.keys(proposedManifests)].sort());
  });
});

// Components whose specification (jobs, contract, governance) is still to be written. This list can only SHRINK: a component that is
// specified must come off it, and a component that is not must be on it, so the work can neither be forgotten nor silently dropped.
const PENDING_SPECIFICATION: string[] = [];

const specified = Object.values(manifests).filter(isSpecified);
const SOURCE_NAMES = /sampro|xtreme|\bxoi\b|sitedocs|shared[_ ]drive|client[_ ]portal|\bERP\b|connector|\bportal\b/i;

describe('component specifications', () => {
  it('a component outside the BRD 1.2 catalogue says why, and a known gap is written in a full sentence', () => {
    for (const m of Object.values(manifests)) {
      if (m.outsideCatalogue !== undefined) expect(m.outsideCatalogue.trim().length, `${m.name} outsideCatalogue`).toBeGreaterThan(20);
      for (const gap of m.gaps ?? []) expect(gap.trim().length, `${m.name} gap`).toBeGreaterThan(20);
    }
  });

  it('lists exactly the components still pending, so none is forgotten and none is dropped', () => {
    expect(Object.values(manifests).filter((m) => !isSpecified(m)).map((m) => m.name).sort()).toEqual([...PENDING_SPECIFICATION].sort());
  });

  it.each(specified)('$name says what it does, in plain sentences', (m) => {
    expect(m.jobs!.length).toBeGreaterThan(0);
    for (const job of m.jobs!) expect(job.trim().length, `${m.name} job`).toBeGreaterThan(20);
  });

  it.each(specified)('$name cites a BRD section (or the security model) for every governance rule', (m) => {
    for (const g of m.governance!) {
      expect(g.rule.trim().length, `${m.name} rule`).toBeGreaterThan(10);
      expect(g.source, `${m.name}: "${g.rule}"`).toMatch(/^(BRD \d|SECURITY\.md)/);
    }
  });

  it.each(specified)('$name declares a data contract when it has data states, and says why when it has none (5.3 Feature 1A)', (m) => {
    const dataBearing = m.dimensions.data !== 'not-applicable';
    if (m.contract!.kind === 'none') {
      expect(m.contract!.reason.trim().length, `${m.name} reason`).toBeGreaterThan(10);
      expect(dataBearing, `${m.name} has data states but declares no contract`).toBe(false);
    } else {
      // An input has a contract for the value it is given and hands back (BRD 1.2 5.7) even though it has no data states.
      expect(m.contract!.fields.length).toBeGreaterThan(0);
    }
  });

  it.each(specified.filter((m) => m.contract!.kind === 'fields'))('$name\'s contract declares every part of every field (5.3 Feature 1A)', (m) => {
    if (m.contract!.kind !== 'fields') return;
    for (const f of m.contract!.fields) {
      for (const key of ['field', 'type', 'meaning', 'freshness', 'whenAbsent'] as const) expect(f[key].trim(), `${m.name}.${f.field}.${key}`).not.toBe('');
      expect(typeof f.required).toBe('boolean');
    }
  });

  it.each(specified)('$name\'s contract names no source system or connector (5.3 Feature 1B)', (m) => {
    const text = JSON.stringify(m.contract);
    expect(text, m.name).not.toMatch(SOURCE_NAMES);
  });
});
