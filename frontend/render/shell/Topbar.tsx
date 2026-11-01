import { Avatar, Link } from '@/components';
import type { Wire } from '@/contracts';
import type { Viewport } from '@/tokens/tokens.generated';
import { messages } from '../messages';
import styles from './Topbar.module.css';

// The topbar (approved design 03): on a phone it is the wordmark and nothing else. The checkpoint status, the sync marker, the notification bell
// and the avatar are hidden when no checkpoint status is supplied, which is every ordinary state, and that reclaims the space. Freshness and
// connection are shown where they matter (beside the section that is updating, and in the banner under the topbar), not here.
// From tablet up there is room for the workspace name, the feedback link (BRD 1.3 section 6.7) and the worker.
export function Topbar({ layoutId, worker, viewport, onFeedback }: { layoutId: string; worker: Wire.Worker; viewport: Viewport; onFeedback: () => void }) {
  const workspace =
    messages.shell.workspaceLabel[layoutId as keyof typeof messages.shell.workspaceLabel] ?? messages.shell.workspaceLabel.default;
  const compact = viewport === 'mobile';
  return (
    <header className={`${styles.topbar} ${compact ? styles.compact : ''}`}>
      <div className={styles.brand}>
        <span className={`${styles.mark} type-heading-sm`} aria-hidden="true">
          O
        </span>
        <span className="type-heading-md">{messages.brand.name}</span>
        {!compact && (
          <>
            <span className={`${styles.divider} type-body-sm`} aria-hidden="true" />
            <span className={`${styles.workspace} type-body-sm`}>{workspace}</span>
          </>
        )}
      </div>
      {!compact && (
        <div className={styles.status}>
          <Link label={messages.feedback.link} tone="on-chrome" onActivate={onFeedback} />
          <Avatar label={worker.name} />
        </div>
      )}
    </header>
  );
}
