'use client';

import { useId } from 'react';
import { ChartFrame, ChartFrameProps, Legend, MAX_SERIES, SeriesTable, colorClass, formatNumber, slot } from './vizShared';
import styles from './DonutChart.module.css';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
}

export interface DonutChartProps extends ChartFrameProps {
  /** At most FIVE segments. More is presented as a table. */
  segments: readonly DonutSegment[];
  /**
   * The primary value, written in the CENTRE of the ring: supplied text such as "42 packets". A donut with no centred value
   * forces the worker to estimate proportions by eye (BRD 1.3 section 10.5), so it is required.
   */
  centerValue: string;
  centerCaption?: string;
  valueFormat?: (n: number) => string;
  /** `segment-select`: emitted when a segment is chosen, from the ring or the legend. */
  onSegmentSelect?: (segmentId: string) => void;
  selectedSegmentId?: string | null;
  legendLabel: string;
}

const R = 38;
const CX = 50;

function polar(angle: number, r: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CX + r * Math.sin(rad)];
}

/** An annular segment between two angles. A full circle needs two arcs, because a single arc cannot start and end at one point. */
function arc(from: number, to: number, outer: number, inner: number): string {
  const sweep = to - from;
  if (sweep >= 359.99) {
    const [a, b] = [polar(0, outer), polar(180, outer)];
    const [c, d] = [polar(0, inner), polar(180, inner)];
    return `M${a} A${outer} ${outer} 0 1 1 ${b} A${outer} ${outer} 0 1 1 ${a} M${c} A${inner} ${inner} 0 1 0 ${d} A${inner} ${inner} 0 1 0 ${c}Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  return `M${polar(from, outer)} A${outer} ${outer} 0 ${large} 1 ${polar(to, outer)} L${polar(to, inner)} A${inner} ${inner} 0 ${large} 0 ${polar(from, inner)}Z`;
}

// The composition of a set: packet composition, status distribution (BRD 1.2 5.9). Segments are told apart by PATTERN as well as
// colour, and the exact value of every segment is in the legend. The ring draws proportions of the values it is given; it
// assigns no meaning to them.
export function DonutChart({ segments, centerValue, centerCaption, valueFormat = formatNumber, onSegmentSelect, selectedSegmentId, legendLabel, ...frame }: DonutChartProps) {
  const uid = useId().replace(/:/g, '');
  const tooMany = segments.length > MAX_SERIES;
  const drawn = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = drawn.reduce((sum, s) => sum + s.value, 0);
  const hasData = total > 0;

  const arcs = drawn.map((s, i) => {
    const before = drawn.slice(0, i).reduce((sum, p) => sum + p.value, 0);
    const from = (before / total) * 360;
    return { s, d: arc(from, from + (s.value / total) * 360, R, R - 16), index: segments.indexOf(s) };
  });

  return (
    <ChartFrame {...frame} hasData={hasData}>
      {tooMany ? (
        <SeriesTable visible caption={frame.title} categories={segments.map((s) => s.label)} series={[{ id: 'value', name: frame.title, values: segments.map((s) => s.value) }]} formatValue={valueFormat} />
      ) : (
        <>
          <div className={styles.ring}>
            <svg className={styles.svg} viewBox="0 0 100 100" role={onSegmentSelect ? 'group' : 'img'} aria-label={frame.textAlternative}>
              <defs>
                {/* One pattern per slot, drawn in the segment's own colour via currentColor. */}
                {[0, 1, 2, 3, 4].map((k) => (
                  <pattern key={k} id={`${uid}-p${k}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={k === 1 ? 'rotate(45)' : undefined} className={colorClass(k)}>
                    {k === 0 && <rect width="6" height="6" fill="currentColor" />}
                    {k === 1 && <rect width="3" height="6" fill="currentColor" />}
                    {k === 2 && <circle cx="3" cy="3" r="1.4" fill="currentColor" />}
                    {k === 3 && <path d="M0 0H6M0 0V6" stroke="currentColor" strokeWidth="1.6" fill="none" />}
                    {k === 4 && <rect width="3" height="6" fill="currentColor" />}
                  </pattern>
                ))}
              </defs>
              {arcs.map(({ s, d, index }) => (
                <path
                  key={s.id}
                  className={`${styles.segment} ${colorClass(index)}`}
                  d={d}
                  fillRule="evenodd"
                  fill={`url(#${uid}-p${slot(index)})`}
                  stroke="currentColor"
                  strokeWidth="1.2"
                  data-muted={selectedSegmentId && selectedSegmentId !== s.id ? true : undefined}
                  {...(onSegmentSelect
                    ? { role: 'button', tabIndex: 0, 'aria-label': `${s.label}: ${valueFormat(s.value)}`, onClick: () => onSegmentSelect(s.id), onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSegmentSelect(s.id)) }
                    : {})}
                />
              ))}
            </svg>
            {/* The primary value is written in the centre as plain HTML text. */}
            <div className={styles.center}>
              <span className="type-heading-lg">{centerValue}</span>
              {centerCaption && <span className={`${styles.caption} type-caption`}>{centerCaption}</span>}
            </div>
          </div>
          <Legend kind="fill" ariaLabel={legendLabel} items={segments.map((s) => ({ id: s.id, name: s.label, value: valueFormat(s.value) }))} selectedId={selectedSegmentId} onSelect={onSegmentSelect} />
        </>
      )}
    </ChartFrame>
  );
}
