'use client';

import { DegradedBanner, NavigationRail, Skeleton, Surface, TabBar, type NavItemModel, type SkeletonShape } from '@/components';
import { useViewport } from '@/runtime/viewport';
import { universalFor } from '../navigation/universal';
import { messages } from '../messages';
import topbar from '../shell/Topbar.module.css';
import styles from './AssemblingScreen.module.css';

// The workspace while it assembles (the approved design "02 Dashboard assembling"): the shell is there at once, and the content is a
// skeleton laid out like the final Dashboard, so nothing jumps when the real data arrives. Only the wordmark is known, so the topbar
// carries nothing else.
//
// Navigation: Dashboard and the trailing item (More on a phone, Settings beside) are live, because the shell defines them. The two role
// slots are not known yet, so they are placeholders at low opacity.
//
// When the context has not arrived in time (BRD 1.0 error row 2) a plain message appears above the skeleton. It is a polite status, it asks
// nothing of the worker, and it has no retry: the workspace recovery screen replaces this one at the hard timeout. Skeletons do not
// shimmer under reduced motion.
export function AssemblingScreen({ slow }: { slow: boolean }) {
  const viewport = useViewport();
  const { leading, trailing } = universalFor(viewport);
  const items: NavItemModel[] = [
    { destinationId: leading.id, label: leading.label, icon: leading.icon, active: true },
    { destinationId: trailing.id, label: trailing.label, icon: trailing.icon },
  ];
  const nothing = () => {};
  const wide = viewport !== 'mobile';

  return (
    <div className={styles.shell} data-viewport={viewport}>
      <header className={topbar.topbar}>
        <div className={topbar.brand}>
          <span className={topbar.mark} aria-hidden="true">
            O
          </span>
          <span className="type-heading-md">{messages.brand.name}</span>
        </div>
      </header>

      {/* The same band as the final screen, full width under the topbar: a title bar of about 60% width and 24px, then the job lines. */}
      <div className={styles.band} aria-hidden="true">
        <span className={`${styles.bar} ${styles.titleBar}`} />
        <span className={`${styles.bar} ${styles.jobBar}`} />
        <span className={`${styles.bar} ${styles.taskBar}`} />
      </div>

      <div className={styles.body}>
        {wide && (
          <div className={styles.rail}>
            <NavigationRail items={items} ariaLabel={messages.nav.primaryLabel} onSelect={nothing} />
          </div>
        )}

        <div className={styles.page}>
          <div className={styles.content}>
            <main id="primary-content" tabIndex={-1} className={styles.main} aria-busy="true" aria-label={messages.context.assemblingRegion}>
              {slow ? <DegradedBanner message={messages.context.degraded} /> : <p className="visually-hidden" role="status">{messages.context.assembling}</p>}

              <section className={styles.group} aria-hidden="true">
                <Skeleton shape="field-label" />
                <CardSkeleton lines={['field-label', 'body']} />
                <CardSkeleton lines={['field-label', 'body']} />
                <CardSkeleton lines={['field-label', 'body', 'body-short']} />
              </section>

              <section className={styles.group} aria-hidden="true">
                <Skeleton shape="field-label" />
                <div className={styles.strip}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className={styles.segment} />
                  ))}
                </div>
                <CardSkeleton lines={['title', 'field-label', 'body', 'body-short']} />
                <div className={styles.rows}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className={styles.row}>
                      <Skeleton shape="icon" />
                      <Skeleton shape="body" />
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${styles.group} ${styles.actions}`} aria-hidden="true">
                <Skeleton shape="field-label" />
                <div className={styles.buttons}>
                  <Skeleton shape="action-button" />
                  <Skeleton shape="action-button" />
                </div>
              </section>

              {!wide && <SupportingSkeleton />}
            </main>
            {wide && (
              <aside className={styles.aside} aria-hidden="true">
                <SupportingSkeleton />
              </aside>
            )}
          </div>
        </div>
      </div>

      {!wide && (
        <div className={styles.tabBar}>
          <TabBar items={items} ariaLabel={messages.nav.primaryLabel} onSelect={nothing} menuItemId="more" />
        </div>
      )}
    </div>
  );
}

// A card with placeholder lines inside it, like the real ones, so it reads as loading and not as an empty box.
function CardSkeleton({ lines }: { lines: SkeletonShape[] }) {
  return (
    <Surface role="card" padding={4}>
      <div className={styles.cardLines}>
        {lines.map((shape, i) => (
          <Skeleton key={i} shape={shape} />
        ))}
      </div>
    </Surface>
  );
}

// The work order and the history: supporting information on a panel, as in the final layout.
function SupportingSkeleton() {
  return (
    <>
      <Surface role="panel" padding={4}>
        <div className={styles.panel}>
          <Skeleton shape="title" />
          <Skeleton shape="field-label" />
          <Skeleton shape="field-value" />
          <Skeleton shape="field-label" />
          <Skeleton shape="field-value" />
          <Skeleton shape="field-label" />
          <Skeleton shape="field-value" />
        </div>
      </Surface>
    </>
  );
}
