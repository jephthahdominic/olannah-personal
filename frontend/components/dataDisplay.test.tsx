// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StatTile, RecordList, HistoryList, DegradedBanner, type HistoryListProps } from './index';

describe('StatTile', () => {
  it('renders a supplied figure, label and caption, and computes nothing', () => {
    render(<StatTile label="Jobs today" value={4} caption="2 need attention" />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Jobs today')).toBeInTheDocument();
    expect(screen.getByText('2 need attention')).toBeInTheDocument();
  });

  it('shows a string figure as given (no reformatting into another meaning)', () => {
    render(<StatTile label="Open value" value="$42,860" />);
    expect(screen.getByText('$42,860')).toBeInTheDocument();
  });

  it('marks attention with the caption text as well as the border, so meaning is never color alone', () => {
    const { container } = render(<StatTile label="Late" value={1} caption="1 job is behind" tone="attention" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/attention/);
    expect(screen.getByText('1 job is behind')).toBeInTheDocument();
  });
});

describe('RecordList', () => {
  const records = [
    { id: 'a', timeLocal: '13:15', title: 'Union Coffee Roasters', subtitle: 'Preventive maintenance', status: { label: 'Approved', tone: 'success' as const } },
    { id: 'b', title: 'Beacon Hotel', trailing: '3h 40m' },
  ];

  it('renders rows in the supplied order, with site-local times formatted but not converted', () => {
    render(<RecordList records={records} ariaLabel="Queue" emptyTitle="Nothing" emptyExplanation="Appears when assigned." />);
    const rows = within(screen.getByRole('list', { name: 'Queue' })).getAllByRole('listitem');
    expect(rows[0].textContent).toContain('1:15 PM');
    expect(rows[0].textContent).toContain('Approved');
    expect(rows[1].textContent).toContain('Beacon Hotel');
    expect(rows[1].textContent).toContain('3h 40m');
  });

  it('never reorders: the order given is the order shown', () => {
    render(<RecordList records={[...records].reverse()} ariaLabel="Queue" emptyTitle="Nothing" emptyExplanation="x" />);
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows[0].textContent).toContain('Beacon Hotel');
  });

  it('rows are plain text unless selectable, and emit row-select when they are', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<RecordList records={records} ariaLabel="Queue" emptyTitle="Nothing" emptyExplanation="x" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    rerender(<RecordList records={records} ariaLabel="Queue" emptyTitle="Nothing" emptyExplanation="x" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('explains an empty list instead of rendering blank', () => {
    render(<RecordList records={[]} ariaLabel="Queue" emptyTitle="Nothing queued" emptyExplanation="Items appear as work is assigned." />);
    expect(screen.getByText('Nothing queued')).toBeInTheDocument();
    expect(screen.getByText('Items appear as work is assigned.')).toBeInTheDocument();
  });
});

const base: HistoryListProps = {
  status: 'ready',
  records: [
    { id: '1', occurredOn: '2026-09-21', title: 'Slow recovery', summary: 'No parts used.' },
    { id: '2', occurredOn: '2026-09-04', title: 'Ice cleared' },
  ],
  loadingMore: false,
  hasMore: false,
  ariaLabel: 'Service history',
  emptyTitle: 'No history yet',
  emptyExplanation: 'Past visits appear here.',
  errorTitle: 'History unavailable',
  errorExplanation: 'We could not load it.',
  retryLabel: 'Try again',
  loadMoreLabel: 'Show earlier visits',
  loadingLabel: 'Loading service history',
  onRetry: () => {},
  onRequestMore: () => {},
};

describe('HistoryList (BRD 1.2 5.6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a loading state, announced as busy, and never a blank list', () => {
    const { container } = render(<HistoryList {...base} status="loading" records={[]} />);
    const loading = screen.getByRole('status', { name: 'Loading service history' });
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders delivered records with site-local dates formatted, not converted', () => {
    render(<HistoryList {...base} />);
    const list = screen.getByRole('list', { name: 'Service history' });
    expect(within(list).getByText('Sep 21')).toBeInTheDocument();
    expect(within(list).getByText('Slow recovery')).toBeInTheDocument();
    expect(within(list).getByText('No parts used.')).toBeInTheDocument();
  });

  it('explains an empty history', () => {
    render(<HistoryList {...base} status="empty" records={[]} />);
    expect(screen.getByText('No history yet')).toBeInTheDocument();
  });

  it('shows the unavailable state with a retry', () => {
    const onRetry = vi.fn();
    render(<HistoryList {...base} status="error" records={[]} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('History unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows a degraded banner only with the SUPPLIED message, and still shows the records', () => {
    render(<HistoryList {...base} status="degraded" degradedMessage="Some older records could not be loaded." />);
    expect(screen.getByText('Some older records could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('Slow recovery')).toBeInTheDocument();
  });

  it('asks for more (request-more) when the end of the list scrolls into view, and fetches nothing itself', () => {
    let trigger!: (entries: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal('IntersectionObserver', class { constructor(cb: typeof trigger) { trigger = cb; } observe() {} disconnect() {} });
    const onRequestMore = vi.fn();
    render(<HistoryList {...base} hasMore onRequestMore={onRequestMore} />);
    trigger([{ isIntersecting: false }]);
    expect(onRequestMore).not.toHaveBeenCalled();
    trigger([{ isIntersecting: true }]);
    expect(onRequestMore).toHaveBeenCalledTimes(1);
  });

  it('does not observe while a page is already loading, and shows a loading row', () => {
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', class { observe = observe; disconnect() {} });
    render(<HistoryList {...base} hasMore loadingMore />);
    expect(observe).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Loading service history' })).toBeInTheDocument();
  });

  it('falls back to a button where scroll loading is unavailable (also reachable by keyboard)', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onRequestMore = vi.fn();
    render(<HistoryList {...base} hasMore onRequestMore={onRequestMore} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier visits' }));
    expect(onRequestMore).toHaveBeenCalled();
  });

  it('shows no load-more control when there is nothing more', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<HistoryList {...base} hasMore={false} />);
    expect(screen.queryByRole('button', { name: 'Show earlier visits' })).toBeNull();
  });
});

describe('DegradedBanner secondary link', () => {
  it('renders a navigating secondary action as a link (contact support), not a button', () => {
    render(<DegradedBanner message="Reconnection failed" severity="error" actionLabel="Try again" onAction={() => {}} secondaryLabel="Contact support" secondaryHref="mailto:help@example.test" />);
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:help@example.test');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
