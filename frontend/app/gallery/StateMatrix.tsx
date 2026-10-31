'use client';

import { useState } from 'react';
import type { ComponentManifest } from '@/components/manifests';
import { Surface } from '@/components';
import { STORIES, isLive } from './stories';
import styles from './StateMatrix.module.css';

// Every state a component declares, laid out the same way for every component (HistoryList's switcher is the reference): one row per
// state dimension (BRD 1.2 5.13), one button per declared state, and the chosen state shown below. A dimension that does not apply says
// "Not applicable" and a state without a story cannot occur, because the build fails on it. So "not applicable" and "not yet documented"
// are never confused: a row is either a list of states that each have a story, or it is marked not applicable on purpose.
const DIMENSIONS = [
  { key: 'data', label: 'Data' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'runtime', label: 'Runtime' },
] as const;

const words = (state: string) => state.charAt(0).toUpperCase() + state.slice(1);

export function StateMatrix({ manifest, id }: { manifest: ComponentManifest; id: string }) {
  const stories = STORIES[manifest.name] ?? {};
  const first = DIMENSIONS.map((d) => ({ d: d.key, states: manifest.dimensions[d.key] })).find((x) => x.states !== 'not-applicable');
  const [chosen, setChosen] = useState<string | null>(first && first.states !== 'not-applicable' ? (first.states.includes('ready') ? 'ready' : first.states.includes('default') ? 'default' : first.states[0]) : null);
  const story = chosen ? stories[chosen] : undefined;
  const allNotApplicable = DIMENSIONS.every((d) => manifest.dimensions[d.key] === 'not-applicable');

  return (
    <details className={styles.matrix}>
      <summary className="type-label">States</summary>
      <div className={styles.body}>
        <dl className={styles.rows}>
          {DIMENSIONS.map((d) => {
            const states = manifest.dimensions[d.key];
            return (
              <div key={d.key} className={styles.row}>
                <dt className="type-caption">{d.label}</dt>
                <dd>
                  {states === 'not-applicable' ? (
                    <span className={`${styles.na} type-body-sm`}>Not applicable</span>
                  ) : (
                    <span className={styles.buttons} role="group" aria-label={`${manifest.name} ${d.label.toLowerCase()} states`}>
                      {states.map((state) => (
                        <button key={state} type="button" aria-pressed={chosen === state} className={`${styles.state} ${chosen === state ? styles.active : ''} type-body-sm`} onClick={() => setChosen(state)}>
                          {words(state)}
                        </button>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
        {allNotApplicable && <p className="type-body-sm">This component has no states of its own. It looks the same wherever it is used.</p>}
        {chosen && story !== undefined && (
          <div className={styles.stage} role="group" aria-label={`${manifest.name}: ${chosen} state`}>
            <p className={`${styles.stageTitle} type-caption`}>{words(chosen)}</p>
            {isLive(story) ? (
              <p className="type-body-sm">{`The ${chosen} state comes from the browser, so it cannot be forced here. ${story.live} Try it on the example above.`}</p>
            ) : (
              <Surface role="card" padding={4} bordered key={`${id}-${chosen}`}>{story}</Surface>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
