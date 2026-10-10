import { Avatar, Link, SyncDot } from '@/components';
import type { WorkerIdentity } from '@/contracts';
import type { ConnectionStatus } from '@/runtime/canvas/canvasRuntime';
import type { Freshness } from '@/runtime/zones/useZoneFreshness';
import type { Viewport } from '@/tokens/tokens.generated';
import { messages } from '../messages';
import styles from './Topbar.module.css';

// The topbar is defined from the approved designs (brand mark, workspace label, sync state, worker) because the BRDs
// reference a topbar without defining one (SDD R20, Q30). On Evergreen, Warm Cream text (BRD 1.3 section 3.2).
// Feedback link, AI trigger and More are added with the surfaces they open (Stage 4).
export function Topbar({ layoutId, worker, viewport, freshness, connection, onFeedback }: { layoutId: string; worker: WorkerIdentity; viewport: Viewport; freshness: Freshness; connection: ConnectionStatus; onFeedback: () => void }) {
  const workspace =
    messages.shell.workspaceLabel[layoutId as keyof typeof messages.shell.workspaceLabel] ?? messages.shell.workspaceLabel.default;
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          O
        </span>
        <span className="type-heading-md">{messages.brand.name}</span>
        <span className={`${styles.divider} type-body-sm`} aria-hidden="true" />
        <span className={`${styles.workspace} type-body-sm`}>{workspace}</span>
      </div>
      <div className={styles.status}>
        {/* Feedback is a small text link in the topbar on tablet and desktop, always about the current screen. On mobile it is
            reached through the More menu (BRD 1.3 section 6.7). */}
        {viewport !== 'mobile' && <Link label={messages.feedback.link} tone="on-chrome" onActivate={onFeedback} />}
        <span className={styles.sync}>
          {/* Freshness and connectivity are separate dimensions and are never collapsed into one condition. */}
          <SyncDot
            freshness={freshness}
            connectivity={connection === 'connected' || connection === 'connecting' ? 'connected' : connection === 'reconnecting' ? 'reconnecting' : 'disconnected'}
            label={freshness === 'fresh' ? messages.shell.synced : freshness === 'syncing' ? messages.shell.updating : messages.shell.stale}
          />
        </span>
        <Avatar initials={worker.initials} label={worker.displayName} />
        {viewport !== 'mobile' && (
          <span className={styles.identity}>
            <span className="type-heading-sm">{worker.displayName}</span>
            <span className="type-caption">{worker.jobTitle}</span>
          </span>
        )}
      </div>
    </header>
  );
}
