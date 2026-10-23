import { Button, Link, SectionHeader, StatusIndicator } from '@/components';
import { messages } from '../messages';
import { ScreenFrame } from './ScreenFrame';
import styles from './ScreenFrame.module.css';

// BRD 1.0 error rows 3, 4 and 5: wordmark, plain message, a retry action and a contact-support option. The specific
// condition (timeout, version mismatch, malformed payload) is logged and never shown to the worker.
export function WorkspaceRecoveryScreen({
  onRetry,
  supportHref,
  title = messages.recovery.title,
  body = messages.recovery.body,
}: {
  onRetry: () => void;
  supportHref: string;
  title?: string;
  body?: string;
}) {
  return (
    <ScreenFrame>
      <StatusIndicator state="error" label={messages.recovery.errorStatus} size="lg" />
      <SectionHeader text={title} level={1} size="lg" />
      <p className="type-body">{body}</p>
      <div className={styles.actions}>
        <Button label={messages.recovery.retry} onActivate={onRetry} />
        <Link label={messages.recovery.contactSupport} href={supportHref} />
      </div>
    </ScreenFrame>
  );
}
