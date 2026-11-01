'use client';

import type { Wire } from '@/contracts';
import { Label, StatusIndicator, type StatusState } from '@/components';
import type { ZoneContentProps } from '../layout/registry';
import { messages } from '../messages';
import styles from './zones.module.css';

// The alerts zone: Alert[] exactly as delivered (severity, message, suggestion, evidence). The canvas shows them in the order given and
// adds none, hides none and ranks none. Severity is a SUPPLIED value shown as its own shape and a word, never colour alone. The evidence
// (which system, which record) is there for whoever wants it, behind "Source", so it does not crowd the message.
const SHAPE: Record<Wire.Alert['severity'], StatusState> = { critical: 'error', warning: 'warning', info: 'inactive' };

export function AlertsContent({ state }: ZoneContentProps) {
  const alerts = (state.data ?? []) as readonly Wire.Alert[];
  const m = messages.zones.alerts;
  return (
    <ul className={styles.list} aria-label={m.title}>
      {alerts.map((alert) => (
        <li key={alert.id} className={styles.alert} data-severity={alert.severity}>
          <StatusIndicator state={SHAPE[alert.severity]} label={m.severity[alert.severity]} />
          <div className={styles.alertBody}>
            <div className={styles.alertHead}>
              <p className={styles.severity}>
                <Label text={m.severity[alert.severity]} as="span" />
              </p>
              {alert.evidence.length > 0 && (
                <details className={`${styles.source} type-body-sm`}>
                  <summary>{m.evidence}</summary>
                  <p>{alert.evidence.map((e) => `${e.system} ${e.ref}`).join(', ')}</p>
                </details>
              )}
            </div>
            <p className={`${styles.message} type-body`}>{alert.message}</p>
            {alert.suggestion && (
              <p className={`${styles.suggestion} type-body-sm`}>
                <strong>{m.suggestion}:</strong> {alert.suggestion}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
