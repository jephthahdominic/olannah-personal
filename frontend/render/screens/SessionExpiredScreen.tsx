import { Button, SectionHeader, StatusIndicator } from '@/components';
import { messages } from '../messages';
import { ScreenFrame } from './ScreenFrame';

// BRD 1.0 error row 12: wordmark, "session has ended", a note that unsaved work may need re-entering, and a log in
// action as the fallback if the automatic redirect to sign in does not complete.
export function SessionExpiredScreen({ onLogIn }: { onLogIn: () => void }) {
  return (
    <ScreenFrame>
      <StatusIndicator state="inactive" label={messages.expired.title} size="lg" />
      <SectionHeader text={messages.expired.title} level={1} size="lg" />
      <p className="type-body">{messages.expired.body}</p>
      <Button label={messages.expired.logIn} onActivate={onLogIn} />
    </ScreenFrame>
  );
}
