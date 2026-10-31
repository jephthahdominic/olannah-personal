'use client';

import { useMemo } from 'react';
import { Card } from './Gallery';
import { buildProposedEntries } from './entries';
import { COMPONENT_PROPOSALS, SCREEN_PROPOSALS, TOKEN_PROPOSALS, VARIANT_PROPOSALS } from './proposals';
import styles from './Gallery.module.css';
import proposed from './Proposed.module.css';

// What the build contains that no BRD names, held apart from the component library so the spec team can rule on each item. The BRDs
// are the only source for the library; nothing here is part of it.
export function Proposed() {
  const entries = useMemo(() => buildProposedEntries(), []);
  return (
    <div className={proposed.page}>
      <header className={styles.mainHeader}>
        <p className="type-label">For the spec team</p>
        <h1 className="type-heading-lg">Proposed additions</h1>
        <p className={`${styles.summary} type-body`}>
          Items the build holds that no BRD names. They are not in the component library. Each says what needed it, what the BRDs say, and the decision wanted.
        </p>
      </header>

      <section aria-labelledby="p-components" className={proposed.section}>
        <h2 id="p-components" className="type-heading-md">Components not in BRD 1.2 ({entries.length})</h2>
        <div className={styles.grid}>
          {entries.map((entry) => {
            const p = COMPONENT_PROPOSALS[entry.name];
            return (
              <div key={entry.name} className={proposed.componentBlock}>
                <Card entry={entry} />
                {p && (
                  <dl className={proposed.facts}>
                    <div><dt className="type-label">What it is</dt><dd className="type-body-sm">{p.what}</dd></div>
                    <div><dt className="type-label">Needed by</dt><dd className="type-body-sm">{p.neededBy}</dd></div>
                    <div><dt className="type-label">What the BRDs say</dt><dd className="type-body-sm">{p.gap}</dd></div>
                    <div><dt className="type-label">Decision wanted</dt><dd className="type-body-sm">{p.question}</dd></div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="p-tokens" className={proposed.section}>
        <h2 id="p-tokens" className="type-heading-md">Colour tokens not in BRD 1.3 ({TOKEN_PROPOSALS.length})</h2>
        <p className="type-body-sm">Removed from the build. The build uses only BRD 1.3 tokens; the right-hand column is what stands in for each today.</p>
        <div className={proposed.tableWrap}>
          <table className={proposed.table}>
            <thead>
              <tr><th scope="col">Token</th><th scope="col">Figma value</th><th scope="col">Used for</th><th scope="col">What the BRD says</th><th scope="col">In the build now</th></tr>
            </thead>
            <tbody>
              {TOKEN_PROPOSALS.map((t) => (
                <tr key={t.token}>
                  <th scope="row"><code>{t.token}</code></th>
                  <td><span className={proposed.swatch} style={{ background: t.value }} aria-hidden="true" /> {t.value}</td>
                  <td>{t.used}</td>
                  <td>{t.gap}</td>
                  <td>{t.inBuildNow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="p-screens" className={proposed.section}>
        <h2 id="p-screens" className="type-heading-md">Screens and zones not in a BRD ({SCREEN_PROPOSALS.length})</h2>
        <ul className={proposed.list}>
          {SCREEN_PROPOSALS.map((s) => (
            <li key={s.id} className={proposed.item}>
              <h3 className="type-heading-sm">{s.title}</h3>
              <dl className={proposed.facts}>
                <div><dt className="type-label">What it is</dt><dd className="type-body-sm">{s.what}</dd></div>
                <div><dt className="type-label">Needed by</dt><dd className="type-body-sm">{s.neededBy}</dd></div>
                <div><dt className="type-label">What the BRDs say</dt><dd className="type-body-sm">{s.gap}</dd></div>
                <div><dt className="type-label">Decision wanted</dt><dd className="type-body-sm">{s.question}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="p-variants" className={proposed.section}>
        <h2 id="p-variants" className="type-heading-md">Additions to BRD 1.2 components ({VARIANT_PROPOSALS.length})</h2>
        <p className="type-body-sm">These components are in BRD 1.2. The listed behaviour is not in what the BRD specifies for them. Every other addition has been removed.</p>
        <ul className={proposed.list}>
          {VARIANT_PROPOSALS.map((v) => (
            <li key={v.component} className={proposed.item}>
              <strong className="type-body-sm">{v.component}</strong> <span className="type-body-sm">{v.addition}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
