import { isSpecified, type ComponentManifest } from '@/components/manifests';
import propsByComponent from '@/components/props.generated.json';
import styles from './Specification.module.css';

interface PropRow { name: string; type: string; required: boolean; description: string }
const propsOf = (name: string): readonly PropRow[] => (propsByComponent as Record<string, { props: PropRow[] }>)[name]?.props ?? [];

// A component's specification, shown from its manifest (BRD 1.2 5.2, 5.3, 5.5.1 onward): what it does, the data it needs, the rules it
// must obey, its states and events, its accessibility obligations and what it must never do. Read-only and generated, so it cannot drift
// from the manifest the build checks.
const words = (tag: string) => {
  const text = tag.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const list = (value: readonly string[] | 'not-applicable') => (value === 'not-applicable' ? 'Not applicable' : value.join(', '));

export function Specification({ manifest: m, id }: { manifest: ComponentManifest; id: string }) {
  const specified = isSpecified(m);
  return (
    <details className={styles.spec}>
      <summary className="type-label">{specified ? 'Specification' : 'Specification (in progress)'}</summary>
      <div className={styles.body}>
        {!specified && (
          <p className={`${styles.note} type-body-sm`}>What this component does, the data it needs and the rules it must follow are still to be written. The sections below are already declared.</p>
        )}

        {m.outsideCatalogue && (
          <p className={`${styles.flag} type-body-sm`} role="note">
            <strong>Not in the BRD 1.2 catalogue.</strong> {m.outsideCatalogue}
          </p>
        )}

        {m.jobs && (
          <section aria-labelledby={`${id}-jobs`}>
            <h3 id={`${id}-jobs`} className="type-label">What it does</h3>
            {m.jobs.map((job) => (
              <p key={job} className="type-body-sm">{job}</p>
            ))}
          </section>
        )}

        {m.contract && (
          <section aria-labelledby={`${id}-contract`}>
            <h3 id={`${id}-contract`} className="type-label">Data contract</h3>
            {m.contract.kind === 'none' ? (
              <p className="type-body-sm">{m.contract.reason}</p>
            ) : (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <caption className="visually-hidden">{`${m.name} data contract`}</caption>
                  <thead>
                    <tr>
                      {['Field', 'Type', 'Required', 'What it means', 'How fresh', 'When absent'].map((h) => (
                        <th key={h} scope="col" className="type-caption">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.contract.fields.map((f) => (
                      <tr key={f.field}>
                        <th scope="row" className="type-data">{f.field}</th>
                        <td className="type-body-sm">{f.type}</td>
                        <td className="type-body-sm">{f.required ? 'Yes' : 'No'}</td>
                        <td className="type-body-sm">{f.meaning}</td>
                        <td className="type-body-sm">{f.freshness}</td>
                        <td className="type-body-sm">{f.whenAbsent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section aria-labelledby={`${id}-props`}>
          <h3 id={`${id}-props`} className="type-label">Props</h3>
          {propsOf(m.name).length === 0 ? (
            <p className="type-body-sm">Takes no props.</p>
          ) : (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <caption className="visually-hidden">{`${m.name} props`}</caption>
                <thead>
                  <tr>
                    {['Name', 'Type', 'Required', 'Description'].map((h) => (
                      <th key={h} scope="col" className="type-caption">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propsOf(m.name).map((prop) => (
                    <tr key={prop.name}>
                      <th scope="row" className="type-data">{prop.name}</th>
                      <td className="type-body-sm">{prop.type}</td>
                      <td className="type-body-sm">{prop.required ? 'Yes' : 'No'}</td>
                      <td className="type-body-sm">{prop.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {m.governance && (
          <section aria-labelledby={`${id}-governance`}>
            <h3 id={`${id}-governance`} className="type-label">Rules it must follow</h3>
            <ul className={styles.rules}>
              {m.governance.map((g) => (
                <li key={g.rule}>
                  <span className="type-body-sm">{g.rule}</span> <span className={`${styles.source} type-caption`}>{g.source}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {m.gaps && m.gaps.length > 0 && (
          <section aria-labelledby={`${id}-gaps`}>
            <h3 id={`${id}-gaps`} className="type-label">Known differences from the BRD</h3>
            <ul className={styles.rules}>
              {m.gaps.map((gap) => (
                <li key={gap} className="type-body-sm">{gap}</li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={`${id}-states`}>
          <h3 id={`${id}-states`} className="type-label">States, events and lifecycle</h3>
          <dl className={styles.facts}>
            <dt className="type-caption">Data states</dt><dd className="type-body-sm">{list(m.dimensions.data)}</dd>
            <dt className="type-caption">Interaction states</dt><dd className="type-body-sm">{list(m.dimensions.interaction)}</dd>
            <dt className="type-caption">Runtime states</dt><dd className="type-body-sm">{list(m.dimensions.runtime)}</dd>
            <dt className="type-caption">Events it emits</dt><dd className="type-body-sm">{m.events.length ? m.events.join(', ') : 'None'}</dd>
            <dt className="type-caption">Lifecycle</dt><dd className="type-body-sm">{m.lifecycle === 'persistence-capable' ? 'Persistence-capable (the shell decides whether it persists)' : 'Ephemeral'}</dd>
            <dt className="type-caption">Used by</dt><dd className="type-body-sm">{m.personas.join(' and ')}</dd>
          </dl>
        </section>

        <section aria-labelledby={`${id}-a11y`}>
          <h3 id={`${id}-a11y`} className="type-label">Accessibility it must meet</h3>
          <dl className={styles.facts}>
            <dt className="type-caption">Contrast</dt><dd className="type-body-sm">{m.a11y.contrast === 'not-applicable' ? 'Not applicable' : m.a11y.contrast}</dd>
            <dt className="type-caption">Touch target</dt><dd className="type-body-sm">{m.a11y.touchTarget === 'not-applicable' ? 'Not applicable' : m.a11y.touchTarget}</dd>
            <dt className="type-caption">Focus</dt><dd className="type-body-sm">{m.a11y.focus === 'not-applicable' ? 'Not applicable' : m.a11y.focus}</dd>
            <dt className="type-caption">Announcement</dt><dd className="type-body-sm">{m.a11y.announcement === 'not-applicable' ? 'Not applicable' : m.a11y.announcement}</dd>
            <dt className="type-caption">Reduced motion</dt><dd className="type-body-sm">{m.a11y.reducedMotion === 'not-applicable' ? 'Not applicable' : m.a11y.reducedMotion}</dd>
          </dl>
        </section>

        {m.prohibited.length > 0 && (
          <section aria-labelledby={`${id}-never`}>
            <h3 id={`${id}-never`} className="type-label">Never allowed</h3>
            <ul className={styles.rules}>
              {m.prohibited.map((tag) => (
                <li key={tag} className="type-body-sm">{words(tag)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
