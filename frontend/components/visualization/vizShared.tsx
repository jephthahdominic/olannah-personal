import type { ReactNode } from 'react';
import { DegradedBanner } from '../DegradedBanner/DegradedBanner';
import { EmptyState } from '../EmptyState/EmptyState';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './visualization.module.css';

// Rules shared by every chart (BRD 1.3 section 10.5, BRD 1.2 5.9.1):
//  - never more than FIVE series (more is presented as a table, which is the remedy the BRD names);
//  - a supplied text alternative surfacing the key value, in plain text ADJACENT to the chart;
//  - never blank: loading shows a skeleton, no data shows a plain-language explanation of why;
//  - degraded renders only when SUPPLIED;
//  - series are distinguishable without color; semantic colors are never used.

export const MAX_SERIES = 5;

export interface ChartSeries {
  id: string;
  name: string;
  /** One value per category or point, in order. `null` is a missing value: BarChart draws no bar, LineChart leaves a gap. */
  values: readonly (number | null)[];
}

export type ChartStatus = 'loading' | 'ready' | 'degraded';

/** The props every chart shares. Every one is SUPPLIED: a chart renders, it never computes a business value. */
export interface ChartFrameProps {
  title: string;
  /** The key value in plain text. A worker who cannot read the chart for any reason must still be able to read the truth it shows. */
  textAlternative: string;
  status?: ChartStatus;
  /** Supplied when the data is partial. Never inferred from the data. */
  degradedMessage?: string;
  emptyTitle: string;
  emptyExplanation: string;
}

/** Series slot to style slot. Slots map to viz-1..viz-5 in order, so viz-3 (slot 2) and viz-5 (slot 4) are never adjacent. */
export const slot = (index: number): number => index % MAX_SERIES;
export const colorClass = (index: number) => styles[`s${slot(index)}`];
export const fillClass = (index: number) => `${styles[`fill${slot(index)}`]} ${styles.outlined} ${colorClass(index)}`;
export const lineKeyClass = (index: number) => `${styles[`d${slot(index)}`]} ${colorClass(index)}`;
export const markerClass = (index: number) => `${styles.marker} ${styles[`m${slot(index)}`]}`;

/** Rounds a maximum up to a tidy axis ceiling (1, 2, 5, 10 times a power of ten). Geometry only. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(max));
  const fraction = max / exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
}

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatNumber = (n: number): string => NUMBER.format(n);

export const percentOf = (value: number, whole: number): number => (whole <= 0 ? 0 : Math.min(100, Math.max(0, (value / whole) * 100)));

/** True when at least one series has at least one plottable (finite, non-null) value. */
export function hasPlottable(series: readonly ChartSeries[]): boolean {
  return series.some((s) => s.values.some((v) => v !== null && Number.isFinite(v)));
}

/** The shared frame: title, supplied degraded banner, loading or empty state, the chart, and the adjacent text alternative. */
export function ChartFrame({ title, textAlternative, status = 'ready', degradedMessage, emptyTitle, emptyExplanation, hasData, children }: ChartFrameProps & { hasData: boolean; children: ReactNode }) {
  return (
    <figure className={styles.figure} aria-label={title} aria-busy={status === 'loading' || undefined}>
      <p className={`${styles.title} type-heading-sm`}>{title}</p>
      {status === 'degraded' && degradedMessage && <DegradedBanner message={degradedMessage} />}
      {status === 'loading' ? (
        <div role="status" aria-label={title} aria-busy="true">
          <Skeleton shape="card" cardHeight="md" />
        </div>
      ) : hasData ? (
        <>
          {children}
          {/* The key value in plain text, adjacent to the chart. */}
          <p className={`${styles.textAlt} type-body-sm`}>{textAlternative}</p>
        </>
      ) : (
        <EmptyState title={emptyTitle} explanation={emptyExplanation} />
      )}
    </figure>
  );
}

export interface LegendItem {
  id: string;
  name: string;
  /** Optional supplied value text beside the name. */
  value?: string;
}

/** Legend keys. Each key repeats the series' pattern or dash, so it matches the chart without relying on color. */
export function Legend({ items, kind, selectedId, onSelect, ariaLabel }: { items: readonly LegendItem[]; kind: 'fill' | 'line'; selectedId?: string | null; onSelect?: (id: string) => void; ariaLabel: string }) {
  return (
    <ul className={styles.legend} aria-label={ariaLabel}>
      {items.map((item, i) => {
        const key =
          kind === 'fill' ? (
            <span className={`${styles.swatch} ${fillClass(i)}`} aria-hidden="true" />
          ) : (
            <svg className={styles.lineKey} viewBox="0 0 28 8" aria-hidden="true">
              <line className={lineKeyClass(i)} x1="0" y1="4" x2="28" y2="4" stroke="currentColor" strokeWidth="2" />
            </svg>
          );
        const body = (
          <>
            {key}
            <span className="type-caption">{item.name}</span>
            {item.value !== undefined && <span className={`${styles.legendValue} type-caption`}>{item.value}</span>}
          </>
        );
        return (
          <li key={item.id}>
            {onSelect ? (
              <button type="button" className={styles.legendItem} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
                {body}
              </button>
            ) : (
              <span className={styles.legendItem}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Every value as a real table. Used two ways: visually hidden beside a chart, so assistive technology reads exact values; and
 * VISIBLE as the replacement when a chart would need more than five series ("beyond five series the chart becomes harder to
 * read than the underlying data table it replaces", BRD 1.3 section 10.5).
 */
export function SeriesTable({ caption, categories, series, visible, noDataLabel = '–', cornerLabel = 'Category', formatValue = formatNumber }: { cornerLabel?: string; caption: string; categories: readonly string[]; series: readonly ChartSeries[]; visible?: boolean; noDataLabel?: string; formatValue?: (n: number) => string }) {
  return (
    <table className={visible ? styles.table : 'visually-hidden'}>
      <caption className={visible ? 'type-heading-sm' : undefined}>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">{cornerLabel}</span>
          </th>
          {series.map((s) => (
            <th key={s.id} scope="col" className="type-label">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((c, row) => (
          <tr key={`${c}-${row}`}>
            <th scope="row" className="type-body-sm">
              {c}
            </th>
            {series.map((s) => {
              const v = s.values[row];
              return (
                <td key={s.id} className={`${styles.num} type-data`}>
                  {v === null || v === undefined || !Number.isFinite(v) ? noDataLabel : formatValue(v)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
