import { formatSiteLocalDate } from '../utils/formatSiteLocal';
import { ChartFrame, ChartFrameProps, Legend, MAX_SERIES, SeriesTable, colorClass, formatNumber, hasPlottable, lineKeyClass, markerClass, niceMax, percentOf, type ChartSeries } from './vizShared';
import styles from './LineChart.module.css';
import shared from './visualization.module.css';

export interface LineChartProps extends ChartFrameProps {
  /** One label per point, in order. The time axis is named by its specific meaning, for example a site-local date. */
  xLabels: readonly string[];
  /** `site-local-date` formats "YYYY-MM-DD" labels without converting them to the viewer's time zone (BRD 1.2 5.3 Feature 2). */
  xKind?: 'text' | 'site-local-date';
  /** At most FIVE series. More is presented as a table. `null` values leave a gap in the line: the chart never invents a point. */
  series: readonly ChartSeries[];
  valueFormat?: (n: number) => string;
  /** `point-select`: emitted when a point is chosen. When absent, points are not interactive and take no focus. */
  onPointSelect?: (selection: { seriesId: string; index: number }) => void;
  legendLabel: string;
}

const MAX_X_LABELS = 6;

// A trend over time: consumption, volume, SLA over a period (BRD 1.2 5.9). It draws the points it is given and derives no trend
// line (BRD 1.2 5.9 prohibited). Series are told apart by DASH STYLE and MARKER SHAPE as well as colour. The lines are an SVG
// stretched over the plot; every label, marker and touch target is HTML, so text cannot shrink below 11px and a marker's hit
// area is a genuine 44px.
export function LineChart({ xLabels, xKind = 'text', series, valueFormat = formatNumber, onPointSelect, legendLabel, ...frame }: LineChartProps) {
  const tooMany = series.length > MAX_SERIES;
  const labels = xLabels.map((l) => (xKind === 'site-local-date' ? formatSiteLocalDate(l) : l));
  const hasData = hasPlottable(series);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))));
  const ticks = [max, max / 2, 0];
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - percentOf(v, max);
  const step = Math.max(1, Math.ceil(n / MAX_X_LABELS));

  // One path per run of consecutive real values. A missing value breaks the line instead of being bridged.
  const paths = (s: ChartSeries): string[] => {
    const runs: string[] = [];
    let current = '';
    s.values.forEach((v, i) => {
      if (v === null || v === undefined || !Number.isFinite(v)) {
        if (current) runs.push(current);
        current = '';
        return;
      }
      current += `${current ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)} `;
    });
    if (current) runs.push(current);
    return runs.filter((d) => d.includes('L')); // a lone point has no line, only its marker
  };

  return (
    <ChartFrame {...frame} hasData={hasData}>
      {tooMany ? (
        <SeriesTable visible caption={frame.title} categories={labels} series={series} formatValue={valueFormat} />
      ) : (
        <>
          <div className={styles.plot}>
            <div className={styles.yAxis} aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className={`${shared.axis} type-caption`}>
                  {valueFormat(t)}
                </span>
              ))}
            </div>
            <div className={styles.area}>
              <div className={styles.canvas}>
                <div className={styles.grid} aria-hidden="true">
                  <span /> <span /> <span />
                </div>
                <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {series.map((s, si) =>
                    paths(s).map((d, k) => <path key={`${s.id}-${k}`} className={lineKeyClass(si)} d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />),
                  )}
                </svg>
                {series.map((s, si) =>
                  s.values.map((v, i) => {
                    if (v === null || v === undefined || !Number.isFinite(v)) return null;
                    const pos = { insetInlineStart: `${x(i)}%`, insetBlockStart: `${y(v)}%` };
                    const mark = <span className={`${markerClass(si)} ${colorClass(si)}`} />;
                    return onPointSelect ? (
                      <button key={`${s.id}-${i}`} type="button" className={styles.point} style={pos} aria-label={`${s.name}, ${labels[i]}: ${valueFormat(v)}`} onClick={() => onPointSelect({ seriesId: s.id, index: i })}>
                        {mark}
                      </button>
                    ) : (
                      <span key={`${s.id}-${i}`} className={styles.dot} style={pos} aria-hidden="true">
                        {mark}
                      </span>
                    );
                  }),
                )}
              </div>
              <div className={styles.xAxis} aria-hidden="true">
                {labels.map((l, i) =>
                  i % step === 0 || i === n - 1 ? (
                    <span key={`${l}-${i}`} className={`${shared.axis} ${styles.xLabel} type-caption`} style={{ insetInlineStart: `${x(i)}%` }}>
                      {l}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </div>
          <Legend kind="line" ariaLabel={legendLabel} items={series.map((s) => ({ id: s.id, name: s.name }))} />
          <SeriesTable caption={frame.title} categories={labels} series={series} formatValue={valueFormat} />
        </>
      )}
    </ChartFrame>
  );
}
