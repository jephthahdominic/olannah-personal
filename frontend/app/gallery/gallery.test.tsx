// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import axe from 'axe-core';
import { manifests } from '@/components/manifests';
import { PLANNED } from './planned';
import { PURPOSES } from './purposes';
import { DEMOS } from './demos';
import { GROUPS } from './groups';
import { Gallery } from './Gallery';

describe('gallery completeness', () => {
  it('every built component has a purpose and a live example', () => {
    for (const name of Object.keys(manifests)) {
      expect(PURPOSES[name], `${name} purpose`).toBeTruthy();
      expect(DEMOS[name], `${name} demo`).toBeDefined();
    }
  });
  it('no planned component is already built, and no purpose or demo is orphaned', () => {
    for (const p of PLANNED) expect(manifests[p.name], `${p.name} is built but still listed as planned`).toBeUndefined();
    for (const name of [...Object.keys(PURPOSES), ...Object.keys(DEMOS)]) expect(manifests[name], `${name} has no manifest`).toBeDefined();
  });
  it('every component belongs to one of the seven groups', () => {
    const ids = GROUPS.map((g) => g.id);
    for (const m of Object.values(manifests)) expect(ids).toContain(m.category);
    for (const p of PLANNED) expect(ids).toContain(p.category);
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
