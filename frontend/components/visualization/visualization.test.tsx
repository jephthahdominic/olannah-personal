// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import axe from 'axe-core';
import { BarChart, DonutChart, LineChart, ProgressRing, SLAIndicator, maxChartSeries } from './index';
import { slot } from './vizShared';

// BRD 1.3 section 10 (visualization standards) and BRD 1.2 5.9 (visualization components), estimator P0.5.

const TEXT = { emptyTitle: 'No data yet', emptyExplanation: 'Figures appear once quotes are drafted.' };
const series = (n: number, values: (number | null)[] = [1, 2, 3]) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Series ${i + 1}`, values }));
const bar = (over: Partial<Parameters<typeof BarChart>[0]> = {}) => (
  <BarChart title="Quotes this week" legendLabel="Quote status" categories={['Mon', 'Tue', 'Wed']} series={series(2)} textAlternative="Quotes peaked on Wednesday." {...TEXT} {...over} />
);

describe('palette rules (BRD 1.3 section 10.2)', () => {
  const dir = __dirname;
  const sources = readdirSync(dir).filter((f) => f.endsWith('.css') || f.endsWith('.tsx')).filter((f) => !f.endsWith('.test.tsx'));

  it('uses only the visualization palette for data: never a semantic or brand color anywhere in the group', () => {
    for (const file of sources) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/--color-semantic-/);
      expect(text, file).not.toMatch(/--color-brand-/);
    }
  });

  it('assigns series to viz-1..viz-5 in order, so viz-3 and viz-5 are never adjacent for any number of series', () => {
    for (let n = 1; n <= 5; n++) {
      const slots = Array.from({ length: n }, (_, i) => slot(i));
      for (let i = 1; i < slots.length; i++) expect(new Set([slots[i - 1], slots[i]])).not.toEqual(new Set([2, 4]));
    }
  });

  it('exposes the five-series ceiling', () => {
    expect(maxChartSeries).toBe(5);
  });
});

describe('ProgressRing', () => {
  it('writes the figure in the centre and exposes a supplied text alternative', () => {
    render(<ProgressRing value={7} total={10} centeredLabel="70%" textAlternative="Quote completeness: 7 of 10 items." emptyExplanation="Nothing to count." />);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Quote completeness: 7 of 10 items.' })).toBeInTheDocument();
  });

  it.each([
    [7, 10, '70 30'],
    [0, 10, '0 100'],
    [10, 10, '100 0'],
    [15, 10, '100 0'], // over the whole is clamped for drawing; the supplied label still says what it says
    [-3, 10, '0 100'],
  ])('draws %i of %i as the arc "%s"', (value, total, dash) => {
    const { container } = render(<ProgressRing value={value} total={total} centeredLabel="x" textAlternative="t" emptyExplanation="e" />);
    expect(container.querySelector('circle[stroke-dasharray]')).toHaveAttribute('stroke-dasharray', dash);
  });

  it.each([[0], [-1], [NaN]])('explains an empty ring (total %s) rather than drawing nothing', (total) => {
    const { container } = render(<ProgressRing value={3} total={total} centeredLabel="x" textAlternative="t" emptyExplanation="Nothing to count yet." />);
    expect(screen.getByText('Nothing to count yet.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('comes in the two specified sizes', () => {
    const small = render(<ProgressRing value={1} total={2} centeredLabel="50%" textAlternative="t" emptyExplanation="e" size={32} />);
    const large = render(<ProgressRing value={1} total={2} centeredLabel="50%" textAlternative="t" emptyExplanation="e" size={48} />);
    expect((small.container.firstChild as HTMLElement).className).not.toBe((large.container.firstChild as HTMLElement).className);
  });
});

describe('SLAIndicator', () => {
  const sla = (over: Partial<Parameters<typeof SLAIndicator>[0]> = {}) => (
    <SLAIndicator title="Response SLA" textAlternative="2h 10m used against a 4h service level." current={130} threshold={240} maximum={300} valueLabel="2h 10m used" thresholdLabel="SLA 4h" {...TEXT} {...over} />
  );

  it('is a meter with its range and a supplied text alternative, and shows the key value as visible text', () => {
    render(sla());
    const meter = screen.getByRole('meter', { name: 'Response SLA' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '300');
    expect(meter).toHaveAttribute('aria-valuenow', '130');
    expect(meter).toHaveAttribute('aria-valuetext', '2h 10m used against a 4h service level.');
    expect(screen.getByText('2h 10m used against a 4h service level.')).toBeInTheDocument(); // adjacent plain text
    expect(screen.getByText('SLA 4h')).toBeInTheDocument(); // the marker has a label, not just a colour
  });

  it('places the fill and the threshold marker by the supplied numbers', () => {
    const { container } = render(sla());
    expect(container.querySelector('[style*="inline-size: 43.33"]')).not.toBeNull(); // 130 / 300
    expect(container.querySelector('[style*="inset-inline-start: 80%"]')).not.toBeNull(); // 240 / 300
  });

  it('does NOT decide whether the SLA is breached: past the threshold it is styled identically and says nothing of its own', () => {
    const classes = (el: Element) => [...el.querySelectorAll('*')].map((n) => n.getAttribute('class'));
    const before = render(sla({ current: 130 }));
    const beforeClasses = classes(before.container);
    before.unmount();
    const after = render(sla({ current: 290, valueLabel: '4h 50m used' }));
    expect(classes(after.container)).toEqual(beforeClasses);
    expect(screen.queryByText(/breach|overdue|late|violat/i)).toBeNull();
  });

  it('clamps the reported value into its own range without inventing a different one', () => {
    render(sla({ current: 999 }));
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '300');
  });

  it.each([[{ maximum: 0 }], [{ maximum: 100, minimum: 100 }], [{ current: NaN }]])('explains an unusable scale %j instead of drawing a broken bar', (over) => {
    render(sla(over));
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('Figures appear once quotes are drafted.')).toBeInTheDocument();
  });

  it('shows the degraded banner ONLY when supplied, and a skeleton while loading', () => {
    const { rerender } = render(sla());
    expect(screen.queryByRole('status')).toBeNull();
    rerender(sla({ status: 'degraded', degradedMessage: 'Using last known times.' }));
    expect(screen.getByText('Using last known times.')).toBeInTheDocument();
    rerender(sla({ status: 'loading' }));
    expect(screen.getByRole('status', { name: 'Response SLA' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('meter')).toBeNull();
  });
});

describe('BarChart', () => {
  it('renders a title, a legend, and the key value as plain text ADJACENT to the chart', () => {
    render(bar());
    expect(screen.getByText('Quotes this week', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Quote status' })).toBeInTheDocument();
    expect(screen.getByText('Quotes peaked on Wednesday.')).toBeInTheDocument();
  });

  it('tells series apart by PATTERN as well as colour: each legend key and each bar carries a different pattern class', () => {
    const { container } = render(bar({ series: series(5) }));
    const keys = [...container.querySelectorAll('li > span > span[class*="swatch"]')];
    expect(keys).toHaveLength(5);
    const patterns = keys.map((k) => [...k.classList].find((c) => /fill\d/.test(c)));
    expect(new Set(patterns).size).toBe(5);
    expect(keys.every((k) => [...k.classList].some((c) => c.includes('outlined')))).toBe(true);
  });

  it('draws one bar per real value and NO bar for a missing value (absence is never mistaken for zero)', () => {
    const { container } = render(bar({ series: [{ id: 'a', name: 'A', values: [3, null, 5] }] }));
    expect(container.querySelectorAll('span[class*="bar"][style]')).toHaveLength(2);
  });

  it('scales bar height to the supplied values against a tidy axis ceiling', () => {
    const { container } = render(bar({ series: [{ id: 'a', name: 'A', values: [4, 2, 1] }] }));
    // max 4 -> axis ceiling 5; 4 is 80% of it
    expect(container.querySelector('span[class*="bar"][style*="block-size: 80%"]')).not.toBeNull();
    expect(container.querySelector('span[class*="bar"][style*="block-size: 40%"]')).not.toBeNull();
    expect(container.textContent).toContain('5'); // the axis shows its ceiling
  });

  it('gives assistive technology every exact value in a table, marking missing values as "no data" (never 0)', () => {
    render(bar({ series: [{ id: 'a', name: 'A', values: [3, null, 5] }] }));
    const table = screen.getByRole('table', { name: 'Quotes this week', hidden: true });
    const cells = within(table).getAllByRole('cell', { hidden: true }).map((c) => c.textContent);
    expect(cells).toEqual(['3', '–', '5']);
  });

  it('never draws more than five series: more is presented as a visible table instead', () => {
    const { container } = render(bar({ series: series(6) }));
    expect(container.querySelector('[class*="plot"]')).toBeNull();
    const table = screen.getByRole('table', { name: 'Quotes this week' });
    expect(table).toBeVisible();
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('Quotes peaked on Wednesday.')).toBeInTheDocument();
  });

  it('shows five series as a chart (the ceiling is inclusive)', () => {
    const { container } = render(bar({ series: series(5) }));
    expect(container.querySelector('[class*="plot"]')).not.toBeNull();
  });

  it.each([[[]], [[{ id: 'a', name: 'A', values: [] }]], [[{ id: 'a', name: 'A', values: [null, null] }]], [[{ id: 'a', name: 'A', values: [NaN] }]]])('explains empty data %j instead of drawing a blank chart', (empty) => {
    const { container } = render(bar({ series: empty as never }));
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Figures appear once quotes are drafted.')).toBeInTheDocument();
    expect(container.querySelector('[class*="plot"]')).toBeNull();
  });

  it('shows a skeleton while loading and a degraded banner only when supplied', () => {
    const { rerender } = render(bar({ status: 'loading' }));
    expect(screen.getByRole('status', { name: 'Quotes this week' })).toHaveAttribute('aria-busy', 'true');
    rerender(bar({ status: 'degraded', degradedMessage: 'Friday is incomplete.' }));
    expect(screen.getByText('Friday is incomplete.')).toBeInTheDocument();
    rerender(bar({ status: 'degraded' })); // degraded with no supplied message shows no invented one
    expect(screen.queryByText('Friday is incomplete.')).toBeNull();
  });

  it('makes series selectable ONLY through legend buttons that meet the touch target, with a pressed state', () => {
    const onSeriesSelect = vi.fn();
    const { rerender } = render(bar({ onSeriesSelect, selectedSeriesId: null }));
    const buttons = within(screen.getByRole('list', { name: 'Quote status' })).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onSeriesSelect).toHaveBeenCalledWith('s1');
    rerender(bar({ onSeriesSelect, selectedSeriesId: 's1' }));
    expect(within(screen.getByRole('list', { name: 'Quote status' })).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no interactive legend when selection is not supplied', () => {
    render(bar());
    expect(within(screen.getByRole('list', { name: 'Quote status' })).queryAllByRole('button')).toHaveLength(0);
  });

  it('supports a horizontal orientation with the same data', () => {
    const { container } = render(bar({ orientation: 'horizontal', series: [{ id: 'a', name: 'A', values: [4, 2, 1] }] }));
    expect(container.querySelector('span[class*="bar"][style*="inline-size: 80%"]')).not.toBeNull();
  });

  it('shows value labels in the data type scale only while they stay legible', () => {
    const few = render(bar({ series: [{ id: 'a', name: 'A', values: [4, 2, 1] }] }));
    expect(few.container.querySelectorAll('[class*="value"]').length).toBe(3);
    few.unmount();
    const many = render(bar({ categories: Array.from({ length: 8 }, (_, i) => `C${i}`), series: series(3, Array(8).fill(2)) }));
    expect(many.container.querySelectorAll('[class*="value"]').length).toBe(0);
  });

  it('keeps every chart text as HTML (never SVG text that could scale below the 11px floor)', () => {
    const { container } = render(bar());
    expect(container.querySelector('svg text')).toBeNull();
  });
});

describe('LineChart', () => {
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
  const line = (over: Partial<Parameters<typeof LineChart>[0]> = {}) => (
    <LineChart title="Box temperature" legendLabel="Series" xLabels={dates} xKind="site-local-date" series={[{ id: 'a', name: 'Box temp', values: [19, 12, 4, null, -1] }]} textAlternative="The box recovered from 19°F to -1°F." {...TEXT} {...over} />
  );

  it('breaks the line at a missing value instead of bridging it, and never invents a point', () => {
    const { container } = render(line());
    // runs: [19,12,4] is a line; [-1] is a lone point with a marker but no line
    expect(container.querySelectorAll('svg path')).toHaveLength(1);
    expect(container.querySelectorAll('[class*="dot"]')).toHaveLength(4); // 4 real values, none for the gap
  });

  it('draws two separate lines for two runs of two or more points', () => {
    const { container } = render(line({ series: [{ id: 'a', name: 'A', values: [1, 2, null, 4, 5] }] }));
    expect(container.querySelectorAll('svg path')).toHaveLength(2);
  });

  it('derives no trend line: there is exactly one path per run per series and nothing else is drawn', () => {
    const { container } = render(line({ series: [{ id: 'a', name: 'A', values: [1, 2, 3, 4, 5] }, { id: 'b', name: 'B', values: [5, 4, 3, 2, 1] }] }));
    expect(container.querySelectorAll('svg path')).toHaveLength(2);
    expect(container.querySelectorAll('svg polyline, svg polygon')).toHaveLength(0);
  });

  it('tells series apart by DASH STYLE and MARKER SHAPE as well as colour', () => {
    const { container } = render(line({ series: series(5, [1, 2, 3, 4, 5]) }));
    const dashes = [...container.querySelectorAll('svg path')].map((p) => [...p.classList].find((c) => /d\d/.test(c)));
    expect(new Set(dashes).size).toBe(5);
    const markers = [...container.querySelectorAll('[class*="dot"] > span')].map((m) => [...m.classList].find((c) => /m\d/.test(c)));
    expect(new Set(markers).size).toBe(5);
  });

  it('formats site-local dates on the time axis WITHOUT converting them to the viewer time zone', () => {
    render(line());
    expect(screen.getAllByText('Sep 21').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sep 25').length).toBeGreaterThan(0);
  });

  it('thins crowded axis labels, but keeps the last, and keeps every point in the data table', () => {
    const many = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const { container } = render(line({ xLabels: many, series: [{ id: 'a', name: 'A', values: many.map((_, i) => i) }] }));
    const labels = container.querySelectorAll('[class*="xLabel"]');
    expect(labels.length).toBeLessThan(20);
    expect(screen.getAllByText('Sep 20').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('table', { hidden: true })).getAllByRole('row', { hidden: true })).toHaveLength(21);
  });

  it('makes points interactive ONLY when point-select is supplied, as 44px buttons with a full accessible name', () => {
    const none = render(line());
    expect(none.container.querySelectorAll('button')).toHaveLength(0);
    none.unmount();
    const onPointSelect = vi.fn();
    render(line({ onPointSelect }));
    const point = screen.getByRole('button', { name: 'Box temp, Sep 22: 12' });
    fireEvent.click(point);
    expect(onPointSelect).toHaveBeenCalledWith({ seriesId: 'a', index: 1 });
    expect(screen.getAllByRole('button')).toHaveLength(4);
    const css = readFileSync(join(__dirname, 'LineChart.module.css'), 'utf8');
    expect(css).toMatch(/\.point[\s\S]*inline-size: var\(--width-touch-target\)/);
  });

  it('never draws more than five series, showing a table instead', () => {
    const { container } = render(line({ series: series(6, [1, 2, 3, 4, 5]) }));
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('table', { name: 'Box temperature' })).toBeVisible();
  });

  it('explains empty data, supports loading and supplied degradation, and shows the text alternative', () => {
    const { rerender } = render(line({ series: [{ id: 'a', name: 'A', values: [null, null] }] }));
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    rerender(line({ status: 'loading' }));
    expect(screen.getByRole('status', { name: 'Box temperature' })).toBeInTheDocument();
    rerender(line({ status: 'degraded', degradedMessage: 'Sep 24 is missing.' }));
    expect(screen.getByText('Sep 24 is missing.')).toBeInTheDocument();
    expect(screen.getByText('The box recovered from 19°F to -1°F.')).toBeInTheDocument();
  });

  it('keeps every chart text as HTML', () => {
    expect(render(line()).container.querySelector('svg text')).toBeNull();
  });
});

describe('DonutChart', () => {
  const segments = [{ id: 'a', label: 'Complete', value: 20 }, { id: 'b', label: 'In review', value: 14 }, { id: 'c', label: 'Blocked', value: 8 }];
  const donut = (over: Partial<Parameters<typeof DonutChart>[0]> = {}) => (
    <DonutChart title="Packet composition" legendLabel="Segments" centerValue="42" centerCaption="packets" segments={segments} textAlternative="42 packets: 20 complete, 14 in review, 8 blocked." {...TEXT} {...over} />
  );

  it('writes the primary value in the CENTRE as plain text, so the worker never has to estimate a proportion', () => {
    render(donut());
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('packets')).toBeInTheDocument();
  });

  it('draws one segment per positive value and skips zero, negative and non-finite ones', () => {
    const { container } = render(donut({ segments: [...segments, { id: 'd', label: 'Zero', value: 0 }, { id: 'e', label: 'Neg', value: -4 }] }));
    expect(container.querySelectorAll('svg path[fill^="url("]')).toHaveLength(3);
  });

  it('lists every segment with its exact value in the legend', () => {
    render(donut());
    const legend = screen.getByRole('list', { name: 'Segments' });
    expect(within(legend).getByText('Complete')).toBeInTheDocument();
    expect(within(legend).getByText('20')).toBeInTheDocument();
    expect(within(legend).getByText('8')).toBeInTheDocument();
  });

  it('tells segments apart by PATTERN as well as colour, using five distinct patterns', () => {
    const { container } = render(donut());
    expect(container.querySelectorAll('pattern')).toHaveLength(5);
    const fills = [...container.querySelectorAll('svg path[fill^="url("]')].map((p) => p.getAttribute('fill'));
    expect(new Set(fills).size).toBe(3);
  });

  it('gives every chart instance its own pattern ids, so two donuts on one page cannot restyle each other', () => {
    const { container } = render(<>{donut()}{donut()}</>);
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(new Set(ids).size).toBe(10);
  });

  it('draws a single 100% segment as a full ring', () => {
    const { container } = render(donut({ segments: [{ id: 'a', label: 'All', value: 9 }] }));
    const d = container.querySelector('svg path[fill^="url("]')!.getAttribute('d')!;
    expect(d.length).toBeGreaterThan(20);
    expect(d).not.toContain('NaN');
  });

  it('never produces NaN geometry', () => {
    const { container } = render(donut());
    for (const p of container.querySelectorAll('svg path')) expect(p.getAttribute('d')).not.toContain('NaN');
  });

  it('emits segment-select from the legend and from the ring, by pointer and keyboard', () => {
    const onSegmentSelect = vi.fn();
    const { container } = render(donut({ onSegmentSelect }));
    fireEvent.click(within(screen.getByRole('list', { name: 'Segments' })).getAllByRole('button')[1]);
    expect(onSegmentSelect).toHaveBeenLastCalledWith('b');
    const seg = container.querySelectorAll('svg path[role="button"]')[2];
    fireEvent.click(seg);
    expect(onSegmentSelect).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(seg, { key: 'Enter' });
    fireEvent.keyDown(seg, { key: ' ' });
    expect(onSegmentSelect).toHaveBeenCalledTimes(4);
    expect(seg).toHaveAttribute('aria-label', 'Blocked: 8');
  });

  it('is not interactive when selection is not supplied', () => {
    const { container } = render(donut());
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(screen.getByRole('img', { name: '42 packets: 20 complete, 14 in review, 8 blocked.' })).toBeInTheDocument();
  });

  it('never draws more than five segments, showing a table instead', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, label: `Part ${i + 1}`, value: i + 1 }));
    const { container } = render(donut({ segments: six }));
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('table', { name: 'Packet composition' })).toBeVisible();
  });

  it('explains empty data (no positive value) instead of drawing a ring, and shows a skeleton while loading', () => {
    const { rerender } = render(donut({ segments: [{ id: 'a', label: 'A', value: 0 }] }));
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    rerender(donut({ status: 'loading' }));
    expect(screen.getByRole('status', { name: 'Packet composition' })).toBeInTheDocument();
  });
});

describe('accessibility (axe): every chart in every state', () => {
  async function violations(container: HTMLElement) {
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  }
  const cases: [string, React.ReactElement][] = [
    ['ring', <ProgressRing key="1" value={7} total={10} centeredLabel="70%" textAlternative="7 of 10" emptyExplanation="None" />],
    ['empty ring', <ProgressRing key="2" value={0} total={0} centeredLabel="" textAlternative="" emptyExplanation="None" />],
    ['SLA', <SLAIndicator key="3" title="SLA" textAlternative="2h of 4h" current={120} threshold={240} maximum={300} valueLabel="2h" thresholdLabel="SLA 4h" {...TEXT} />],
    ['bar', bar()],
    ['bar, selectable', bar({ onSeriesSelect: () => {}, selectedSeriesId: 's0' })],
    ['bar, horizontal', bar({ orientation: 'horizontal' })],
    ['bar, six series (table)', bar({ series: series(6) })],
    ['bar, empty', bar({ series: [] })],
    ['bar, loading', bar({ status: 'loading' })],
    ['bar, degraded', bar({ status: 'degraded', degradedMessage: 'Partial.' })],
    ['line', <LineChart key="4" title="L" legendLabel="S" xLabels={['2026-09-21', '2026-09-22', '2026-09-23']} xKind="site-local-date" series={[{ id: 'a', name: 'A', values: [1, null, 3] }]} textAlternative="t" {...TEXT} />],
    ['line, interactive', <LineChart key="5" title="L" legendLabel="S" xLabels={['a', 'b', 'c']} series={series(2)} onPointSelect={() => {}} textAlternative="t" {...TEXT} />],
    ['donut', <DonutChart key="6" title="D" legendLabel="S" centerValue="42" segments={[{ id: 'a', label: 'A', value: 1 }, { id: 'b', label: 'B', value: 2 }]} textAlternative="t" {...TEXT} />],
    ['donut, interactive', <DonutChart key="7" title="D" legendLabel="S" centerValue="42" segments={[{ id: 'a', label: 'A', value: 1 }, { id: 'b', label: 'B', value: 2 }]} onSegmentSelect={() => {}} textAlternative="t" {...TEXT} />],
  ];
  it.each(cases)('%s has no structural violations', async (_name, element) => {
    const { container } = render(element);
    expect(await violations(container)).toEqual([]);
  });
});
