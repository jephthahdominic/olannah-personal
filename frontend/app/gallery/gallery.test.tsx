// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import axe from 'axe-core';
import { manifests, proposedManifests } from '@/components/manifests';
import { PLANNED } from './planned';
import { PURPOSES } from './purposes';
import { DEMOS } from './demos';
import { GROUPS } from './groups';
import { Gallery } from './Gallery';
import { Proposed } from './Proposed';
import { Specification } from './Specification';
import { COMPONENT_PROPOSALS } from './proposals';

describe('gallery completeness', () => {
  it('every built component has a purpose and a live example', () => {
    for (const name of Object.keys(manifests)) {
      expect(PURPOSES[name], `${name} purpose`).toBeTruthy();
      expect(DEMOS[name], `${name} demo`).toBeDefined();
    }
  });
  it('no planned component is already built, and no purpose or demo is orphaned', () => {
    for (const p of PLANNED) expect(manifests[p.name], `${p.name} is built but still listed as planned`).toBeUndefined();
    for (const name of [...Object.keys(PURPOSES), ...Object.keys(DEMOS)]) expect(manifests[name] ?? proposedManifests[name], `${name} has no manifest`).toBeDefined();
  });
  it('every component belongs to one of the seven groups', () => {
    const ids = GROUPS.map((g) => g.id);
    for (const m of Object.values(manifests)) expect(ids).toContain(m.category);
    for (const p of PLANNED) expect(ids).toContain(p.category);
  });
});

describe('Gallery: specification', () => {
  it('shows what a specified component does, its contract and the rules it must follow, each with its BRD source', () => {
    render(<Gallery />);
    const card = screen.getByRole('article', { name: 'Button' });
    const spec = within(card).getByText('Specification', { selector: 'summary' }).closest('details')!;
    expect(within(spec).getByText('What it does')).toBeInTheDocument();
    expect(within(spec).getByText(/names the outcome, tells the canvas it was used/i)).toBeInTheDocument();
    expect(within(spec).getByText('Data contract')).toBeInTheDocument();
    expect(within(spec).getByText(/not data-bearing/i)).toBeInTheDocument();
    expect(within(spec).getByText('Rules it must follow')).toBeInTheDocument();
    expect(within(spec).getByText('BRD 1.2 5.5.1 Feature 3B')).toBeInTheDocument();
    expect(within(spec).getByText('Never allowed')).toBeInTheDocument();
  });

  it('says plainly when a component\'s specification is still to be written, and still shows what is declared', () => {
    // Every library component is specified now, so a manifest with its specification removed stands in for a new one.
    render(<Specification manifest={{ ...manifests.StatusPill, jobs: undefined, contract: undefined, governance: undefined }} id="c-draft" />);
    expect(screen.getByText('Specification (in progress)', { selector: 'summary' })).toBeInTheDocument();
    expect(screen.getByText('Accessibility it must meet')).toBeInTheDocument();
  });
  it('shows a props table with name, type, required and description for a component', () => {
    render(<Gallery />);
    const card = screen.getByRole('article', { name: 'Button' });
    const table = within(card).getByRole('table', { name: 'Button props' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Type', 'Required', 'Description']);
    expect(within(table).getByRole('rowheader', { name: 'variant' })).toBeInTheDocument();
  });
  it('shows each component\'s one-line job on its card', () => {
    render(<Gallery />);
    expect(within(screen.getByRole('article', { name: 'RecordList' })).getByText(/Shows a worker a list of jobs/)).toBeInTheDocument();
  });
});

describe('Gallery', () => {
  it('shows every component with its name, group and what it is for', () => {
    render(<Gallery />);
    const total = Object.keys(manifests).length + PLANNED.length;
    expect(screen.getAllByRole('article')).toHaveLength(total);
    const card = screen.getByRole('article', { name: 'Button' });
    expect(within(card).getByText('Foundation')).toBeInTheDocument();
    expect(within(card).getByText(/action primitive/i)).toBeInTheDocument();
  });
  it('filters to a group when its sidebar tab is chosen, and back to all', () => {
    render(<Gallery />);
    fireEvent.click(screen.getByRole('tab', { name: /^Foundation/ }));
    const cards = screen.getAllByRole('article');
    expect(cards.map((c) => c.getAttribute('aria-labelledby'))).toEqual(['c-Surface', 'c-SectionHeader', 'c-Label', 'c-Icon', 'c-Button', 'c-Link']);
    expect(screen.getByRole('tab', { name: /^Foundation/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /^All components/ }));
    expect(screen.getAllByRole('article').length).toBeGreaterThan(cards.length);
  });
  it('shows the whole Visualization group as built, and lists nothing as "not built yet" now that the catalogue is complete', () => {
    render(<Gallery />);
    fireEvent.click(screen.getByRole('tab', { name: /^Visualization/ }));
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.queryAllByText('Not built yet')).toHaveLength(0);
  });
  it('moves between tabs with the arrow keys', () => {
    render(<Gallery />);
    const all = screen.getByRole('tab', { name: /^All components/ });
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowDown' });
    expect(screen.getByRole('tab', { name: /^Foundation/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Foundation/ })).toHaveFocus();
  });
  it('has no structural accessibility violations in the whole library view', async () => {
    const { container } = render(<Gallery />);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([]);
  });
});

describe('Proposed page', () => {
  it('holds exactly the components BRD 1.2 does not name, each with the question for the spec team, and keeps them out of the library', () => {
    expect(Object.keys(proposedManifests).sort()).toEqual(Object.keys(COMPONENT_PROPOSALS).sort());
    render(<Gallery />);
    for (const name of Object.keys(proposedManifests)) expect(screen.queryByRole('article', { name })).toBeNull();
    cleanup();
    render(<Proposed />);
    for (const name of Object.keys(proposedManifests)) expect(screen.getByRole('article', { name })).toBeInTheDocument();
    expect(screen.getAllByText('Decision wanted').length).toBeGreaterThanOrEqual(Object.keys(proposedManifests).length);
  });
  it('lists the colour tokens that are not in BRD 1.3', () => {
    render(<Proposed />);
    expect(screen.getByRole('heading', { name: /Colour tokens not in BRD 1.3/ })).toBeInTheDocument();
    expect(screen.getByText('color-border-subtle')).toBeInTheDocument();
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<Proposed />);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
