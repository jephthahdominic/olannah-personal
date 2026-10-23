'use client';

import { useState } from 'react';
import { getFaults, setFaults, NO_FAULTS, type MockFaults } from '@/clients/mock/mockIdp';
import { MOCK_ACCOUNTS, MOCK_DOWN_EMAIL, MOCK_LOCKED_EMAIL, MOCK_PASSWORD } from '@/clients/mock/mockUsers';
import styles from './auth.module.css';

// Development-only: shown only when NEXT_PUBLIC_UPSTREAM_MODE is not "real". Lists the mock accounts and lets you
// switch on the failure scenarios from the BRD error taxonomy (SDD 12.5 fault injection).
const DELAYS: { label: string; ms: number }[] = [
  { label: 'Context delivered immediately', ms: 0 },
  { label: 'Context at 0.9s (degraded state)', ms: 900 },
  { label: 'Context at 12s (recovery screen, then ignored)', ms: 12000 },
];
const EXPIRY: { label: string; ms: number | null }[] = [
  { label: 'Session never expires', ms: null },
  { label: 'Session expires 5s after sign in', ms: 5000 },
];

export function MockPanel() {
  const [faults, setLocal] = useState<MockFaults>(() => getFaults());
  const update = (patch: Partial<MockFaults>) => {
    setFaults(patch);
    setLocal({ ...faults, ...patch });
  };

  const toggle = (key: 'sessionNeverArrives' | 'contextNeverArrives' | 'schemaMismatch' | 'envelopeMalformed', label: string) => (
    <label className={`${styles.check} type-body-sm`}>
      <input type="checkbox" checked={faults[key]} onChange={(e) => update({ [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <details className={`${styles.panel} type-body-sm`}>
      <summary className="type-heading-sm">Mock upstream (development only)</summary>
      <div className={styles.panelBody}>
        <p>
          Password for every account: <strong>{MOCK_PASSWORD}</strong>
        </p>
        <ul className={styles.list}>
          {Object.entries(MOCK_ACCOUNTS).map(([account, persona]) => (
            <li key={account}>
              {account} ({persona})
            </li>
          ))}
          <li>{MOCK_LOCKED_EMAIL} (account locked)</li>
          <li>{MOCK_DOWN_EMAIL} (sign in service unavailable)</li>
        </ul>

        {toggle('sessionNeverArrives', 'Session confirmation never arrives')}
        {toggle('contextNeverArrives', 'Context object never arrives')}
        {toggle('schemaMismatch', 'Context has an unrecognized schema version')}
        {toggle('envelopeMalformed', 'Context envelope is malformed')}

        <select
          className={styles.select}
          aria-label="Context delivery delay"
          value={faults.contextDelayMs}
          onChange={(e) => update({ contextDelayMs: Number(e.target.value) })}
        >
          {DELAYS.map((d) => (
            <option key={d.ms} value={d.ms}>
              {d.label}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          aria-label="Session expiry"
          value={faults.sessionExpiresAfterMs ?? ''}
          onChange={(e) => update({ sessionExpiresAfterMs: e.target.value === '' ? null : Number(e.target.value) })}
        >
          {EXPIRY.map((x) => (
            <option key={x.label} value={x.ms ?? ''}>
              {x.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={styles.select}
          onClick={() => {
            setFaults(NO_FAULTS);
            setLocal(NO_FAULTS);
          }}
        >
          Reset all faults
        </button>
      </div>
    </details>
  );
}
