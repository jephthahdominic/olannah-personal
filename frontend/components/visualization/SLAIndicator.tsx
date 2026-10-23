import { ChartFrame, percentOf, type ChartFrameProps } from './vizShared';
import styles from './SLAIndicator.module.css';

export interface SLAIndicatorProps extends ChartFrameProps {
  /** SUPPLIED, named by meaning. The marker reflects what it is given. */
  current: number;
  threshold: number;
  /** The scale. Supplied: the indicator never derives its own bounds. */
  minimum?: number;
  maximum: number;
  /** Supplied text for the current value (for example "2h 10m remaining") and for the threshold marker (for example "SLA 4h"). */
  valueLabel: string;
  thresholdLabel: string;
}

const valid = (n: number) => Number.isFinite(n);

// Time remaining against a service level, with a threshold marker (BRD 1.2 5.9). It does NOT compute whether the SLA is breached,
// and it does not turn red when it is: breach status is a business judgement made upstream and supplied in the text. The
// threshold is marked by a SHAPE and a LABEL, never by color alone.
export function SLAIndicator({ current, threshold, minimum = 0, maximum, valueLabel, thresholdLabel, ...frame }: SLAIndicatorProps) {
  const span = maximum - minimum;
  const usable = valid(current) && valid(threshold) && valid(minimum) && valid(maximum) && span > 0;
  const at = (n: number) => percentOf(n - minimum, span);

  return (
    <ChartFrame {...frame} hasData={usable}>
      {usable && (
        <div className={styles.wrap}>
          <div className={styles.track} role="meter" aria-label={frame.title} aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.min(maximum, Math.max(minimum, current))} aria-valuetext={frame.textAlternative}>
            <div className={styles.fill} style={{ inlineSize: `${at(current)}%` }} />
            <span className={styles.threshold} style={{ insetInlineStart: `${at(threshold)}%` }} aria-hidden="true" />
          </div>
          <div className={styles.labels}>
            <span className="type-data">{valueLabel}</span>
            {/* Positioned under the marker. Plain text, so it can never shrink below the 11px floor. */}
            <span className={`${styles.thresholdLabel} type-caption`} style={{ insetInlineStart: `${at(threshold)}%` }}>
              {thresholdLabel}
            </span>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
