// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import axe from 'axe-core';
import { manifests, proposedManifests } from '@/components/manifests';
import { STORIES, isLive } from './stories';
import { StateMatrix } from './StateMatrix';
import { Gallery } from './Gallery';

// ADR-009: a state a component declares is a state somebody can see. Every declared state has a story, either rendered or, for the states
// the browser produces (hover, pressed, focus), a live instruction. A story for a state the component does not declare is also a failure,
// so the stories cannot drift from the manifests in either direction.
const all = Object.values({ ...manifests, ...proposedManifests });
const declared = (m: (typeof all)[number]) => (['data', 'interaction', 'runtime'] as const).flatMap((d) => (m.dimensions[d] === 'not-applicable' ? [] : [...m.dimensions[d]]));
const BROWSER_STATES = ['hover', 'pressed', 'focus'];

describe('state stories', () => {
  it.each(all)('$name has a story for every declared state and none for an undeclared one', (m) => {
    const stories = STORIES[m.name] ?? {};
    expect(Object.keys(stories).sort(), `${m.name} stories`).toEqual([...new Set(declared(m))].sort());
  });

  it.each(all)('$name only uses a live story for a state the browser produces', (m) => {
    for (const [state, story] of Object.entries(STORIES[m.name] ?? {})) {
      if (isLive(story)) expect(BROWSER_STATES, `${m.name}.${state} is rendered by a prop, so it needs a rendered story`).toContain(state);
    }
  });

  it.each(all.flatMap((m) => Object.entries(STORIES[m.name] ?? {}).filter(([, s]) => !isLive(s)).map(([state, story]) => ({ name: m.name, state, story }))))(
    '$name in its $state state renders with no structural accessibility violation',
    async ({ story }) => {
      const { container } = render(<div>{story as never}</div>);
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    },
  );
});

describe('State matrix', () => {
  it('lists the declared states by dimension, marks the ones that do not apply, and shows the chosen state', () => {
    render(<StateMatrix manifest={manifests.HistoryList} id="c-HistoryList" />);
    const data = screen.getByRole('group', { name: 'HistoryList data states' });
    expect(within(data).getAllByRole('button').map((b) => b.textContent)).toEqual(['Loading', 'Ready', 'Empty', 'Degraded', 'Error']);
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
    fireEvent.click(within(data).getByRole('button', { name: 'Error' }));
    expect(within(data).getByRole('button', { name: 'Error' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'HistoryList: error state' })).toBeInTheDocument();
  });
  it('says plainly that a browser state is reached on the live example', () => {
    render(<StateMatrix manifest={manifests.Button} id="c-Button" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hover' }));
    expect(screen.getByText(/comes from the browser/)).toBeInTheDocument();
  });
  it('says a component with no states of its own looks the same everywhere', () => {
    render(<StateMatrix manifest={manifests.Surface} id="c-Surface" />);
    expect(screen.getAllByText('Not applicable')).toHaveLength(3);
    expect(screen.getByText(/no states of its own/)).toBeInTheDocument();
  });
  it('appears on every library card', () => {
    render(<Gallery />);
    expect(screen.getAllByText('States', { selector: 'summary' })).toHaveLength(Object.keys(manifests).length);
  });
});
