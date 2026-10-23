'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Surface } from '@/components';
import { DEMOS } from './demos';
import { buildEntries, type GalleryEntry } from './entries';
import { GROUPS, groupLabel } from './groups';
import styles from './Gallery.module.css';

type Selected = 'all' | (typeof GROUPS)[number]['id'];
const TABS: readonly { id: Selected; label: string; summary: string }[] = [
  { id: 'all', label: 'All components', summary: 'Every component in the library, grouped by what it does.' },
  ...GROUPS,
];

const COUNT_UP_MS = 2200;

// Ease-in-out (quintic): starts gently, speeds up, then settles slowly into the final value.
const easeInOut = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);

// Counts from 0 to `target` once on mount. `progress` is continuous (0 to 1) so the bar glides; `value` is the whole number shown. Jumps straight to the end when the worker prefers reduced motion.
function useCountUp(target: number) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || target === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off jump to the final value, no animation to schedule
      setProgress(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      setProgress(easeInOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return { progress, value: Math.round(target * progress) };
}

function Card({ entry }: { entry: GalleryEntry }) {
  const demo = DEMOS[entry.name];
  return (
    <article className={`${styles.card} ${entry.built ? '' : styles.planned} ${demo?.wide ? styles.wide : ''}`} aria-labelledby={`c-${entry.name}`}>
      <header className={styles.cardHeader}>
        <h2 id={`c-${entry.name}`} className="type-heading-md">{entry.name}</h2>
        <ul className={styles.chips} aria-label={`${entry.name} details`}>
          <li className={styles.chip}>{groupLabel(entry.category)}</li>
          <li className={styles.chip}>{entry.priority}</li>
          {entry.persistenceCapable && <li className={styles.chip}>Persistence-capable</li>}
          {!entry.built && <li className={`${styles.chip} ${styles.chipPlanned}`}>Not built yet</li>}
        </ul>
        <p className={`${styles.purpose} type-body-sm`}>{entry.purpose}</p>
      </header>
      {entry.built && demo ? (
        <div className={`${styles.stage} ${styles[`stage-${demo.stage ?? 'card'}`]}`}>
          <Surface role={demo.stage === 'chrome' ? 'chrome' : demo.stage === 'workspace' || demo.stage === 'frame' ? 'workspace' : demo.stage === 'panel' ? 'panel' : 'card'} padding={4} bordered>
            {demo.stage === 'frame' ? <div className={styles.frame}>{demo.node}</div> : demo.node}
          </Surface>
        </div>
      ) : (
        <p className={`${styles.note} type-body-sm`}>{entry.note}</p>
      )}
      {entry.built && (
        <footer className={`${styles.footer} type-caption`}>
          {entry.events.length > 0 ? `Emits: ${entry.events.join(', ')}` : 'Emits no events'}
        </footer>
      )}
    </article>
  );
}

// A gallery of the whole component library. Sidebar tabs filter by group (BRD 1.2 5.1 categories). Development and design
// review aid only: it is not a canvas screen and renders sample data.
export function Gallery() {
  const entries = useMemo(() => buildEntries(), []);
  const [selected, setSelected] = useState<Selected>('all');
  const [query, setQuery] = useState('');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Honor a #group link on first load, so a view can be shared.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash is an external system read, done once on mount
    if (TABS.some((t) => t.id === id)) setSelected(id as Selected);
  }, []);

  const choose = (id: Selected) => {
    setSelected(id);
    window.history.replaceState(null, '', id === 'all' ? window.location.pathname : `#${id}`);
  };
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next = index;
    if (event.key in keys) next = (index + keys[event.key] + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    choose(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const countFor = (id: Selected) => (id === 'all' ? entries.length : entries.filter((e) => e.category === id).length);
  const builtTotal = entries.filter((e) => e.built).length;
  const { value: counted, progress } = useCountUp(builtTotal);
  const needle = query.trim().toLowerCase();
  const inGroup = selected === 'all' ? entries : entries.filter((e) => e.category === selected);
  const visible = needle ? inGroup.filter((e) => `${e.name} ${e.purpose} ${groupLabel(e.category)}`.toLowerCase().includes(needle)) : inGroup;
  const tab = TABS.find((t) => t.id === selected)!;

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <p className="type-heading-md">Olannah</p>
          <p className="type-caption">Component library</p>
        </div>
        <label className={styles.search}>
          <span className="visually-hidden">Search components</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or purpose, e.g. button" className="type-body-sm" />
        </label>
        <div role="tablist" aria-label="Component groups" aria-orientation="vertical" className={styles.tabs}>
          {TABS.map((t, index) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected === t.id}
              aria-controls="gallery-panel"
              tabIndex={selected === t.id ? 0 : -1}
              className={`${styles.tab} ${selected === t.id ? `${styles.active} type-nav-label-active` : 'type-nav-label'}`}
              onClick={() => choose(t.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span>{t.label}</span>
              <span className={styles.count}>{countFor(t.id)}</span>
            </button>
          ))}
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.mainHeader}>
          <h1 className="type-heading-lg">{tab.label}</h1>
          <p className={`${styles.summary} type-body`}>{selected === 'all' ? 'All the components used to build the technician and estimator screens.' : tab.summary}</p>
        </header>
        {selected === 'all' && !needle && (
          <section className={styles.summaryBand} aria-label="Library summary">
            <p className={`${styles.summaryLead} type-body`}>
              <span className="visually-hidden">{builtTotal} of {entries.length} components are built and ready to try, across {GROUPS.length} groups.</span>
              <span aria-hidden="true">
                <strong>{counted} of {entries.length}</strong> components are built and ready to try, across {GROUPS.length} groups.
              </span>
            </p>
            <span className={styles.progressEdge} aria-hidden="true" style={{ transform: `scaleX(${progress * (builtTotal / entries.length)})` }} />
          </section>
        )}
        <p className="visually-hidden" role="status">
          Showing {visible.length} {visible.length === 1 ? 'component' : 'components'}.
        </p>
        <div id="gallery-panel" role="tabpanel" aria-labelledby={`tab-${selected}`} className={styles.grid}>
          {visible.map((entry) => (
            <Card key={entry.name} entry={entry} />
          ))}
          {visible.length === 0 && <p className="type-body">No component matches “{query}”. Try a shorter word.</p>}
        </div>
      </main>
    </div>
  );
}
