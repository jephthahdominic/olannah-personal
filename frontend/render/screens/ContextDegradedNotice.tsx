import { StatusIndicator } from '@/components';
import { messages } from '../messages';
import { ScreenFrame } from './ScreenFrame';

// BRD 1.0 error row 2: a recoverable loading state with a visible message. The session does not end and the worker
// takes no action. Warning token + triangle, because this is degraded, not failed.
export function ContextDegradedNotice() {
  return (
    <ScreenFrame>
      <StatusIndicator state="warning" label={messages.session.loadingStatus} size="lg" />
      <p className="type-heading-md" role="status">
        {messages.context.degraded}
      </p>
    </ScreenFrame>
  );
}
