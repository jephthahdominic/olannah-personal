import { ChartFrame, ChartFrameProps, Legend, MAX_SERIES, SeriesTable, fillClass, formatNumber, hasPlottable, niceMax, percentOf, type ChartSeries } from './vizShared';
import styles from './BarChart.module.css';
import shared from './visualization.module.css';

export interface BarChartProps extends ChartFrameProps {
  /** One label per category, in order. Supplied. */
  categories: readonly string[];
  /** At most FIVE series. More is presented as a table, because beyond five the chart is harder to read than the data (BRD 1.3 section 10.5). */
  series: readonly ChartSeries[];
  orientation?: 'vertical' | 'horizontal';
  /** How a value is shown. Defaults to a plain number. Formatting is not deriving. */
  valueFormat?: (n: number) => string;
  /** Controlled selection from the composing layer, for `series-select`. */
  selectedSeriesId?: string | null;
  onSeriesSelect?: (seriesId: string) => void;
  legendLabel: string;
}

const MAX_LABELLED_BARS = 12;

// Comparison across a small set of categories (BRD 1.2 5.9, BRD 1.3 section 10.1). Series are told apart by pattern as well as
// colour. A missing value (null) draws no bar, and the hidden data table says "no data" for it, so absence is never mistaken
// for zero. Bars are not interactive; series are selected through the legend, whose items meet the 44px touch target.
export function BarChart({ categories, series, orientation = 'vertical', valueFormat = formatNumber, selectedSeriesId, onSeriesSelect, legendLabel, ...frame }: BarChartProps) {
  const tooMany = series.length > MAX_SERIES;
  const hasData = hasPlottable(series);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))));
  const ticks = [max, max / 2, 0];
  const labelled = categories.length * series.length <= MAX_LABELLED_BARS;
  const muted = (id: string) => (selectedSeriesId && selectedSeriesId !== id ? true : undefined);

  const bar = (s: ChartSeries, si: number, ci: number, vertical: boolean) => {
    const v = s.values[ci];
    if (v === null || v === undefined || !Number.isFinite(v)) return <span key={s.id} className={styles.gap} />;
    const pct = percentOf(v, max);
    return (
      <span key={s.id} className={`${styles.bar} ${vertical ? styles.v : styles.h} ${fillClass(si)}`} style={vertical ? { blockSize: `${pct}%` } : { inlineSize: `${pct}%` }} data-muted={muted(s.id)}>
        {labelled && <span className={`${styles.value} type-data`}>{valueFormat(v)}</span>}
      </span>
    );
  };

  return (
    <ChartFrame {...frame} hasData={hasData}>
      {tooMany ? (
        <SeriesTable visible caption={frame.title} categories={categories} series={series} formatValue={valueFormat} />
      ) : (
        <>
          <div className={`${styles.plot} ${orientation === 'vertical' ? styles.vertical : styles.horizontal}`} aria-hidden="true">
            {orientation === 'vertical' ? (
              <>
                <div className={styles.yAxis}>
                  {ticks.map((t) => (
                    <span key={t} className={`${shared.axis} type-caption`}>
                      {valueFormat(t)}
                    </span>
                  ))}
                </div>
                <div className={styles.area}>
                  <div className={styles.grid}>
                    <span /> <span /> <span />
                  </div>
                  <div className={styles.groups}>
                    {categories.map((c, ci) => (
                      <div key={`${c}-${ci}`} className={styles.group}>
                        <div className={styles.bars}>{series.map((s, si) => bar(s, si, ci, true))}</div>
                        <span className={`${shared.axis} ${styles.catLabel} type-caption`}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.rows}>
                {categories.map((c, ci) => (
                  <div key={`${c}-${ci}`} className={styles.row}>
                    <span className={`${shared.axis} ${styles.rowLabel} type-caption`}>{c}</span>
                    <div className={styles.rowBars}>{series.map((s, si) => bar(s, si, ci, false))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Legend kind="fill" ariaLabel={legendLabel} items={series.map((s) => ({ id: s.id, name: s.name }))} selectedId={selectedSeriesId} onSelect={onSeriesSelect} />
          {/* Exact values for assistive technology. */}
          <SeriesTable caption={frame.title} categories={categories} series={series} formatValue={valueFormat} />
        </>
      )}
    </ChartFrame>
  );
}
