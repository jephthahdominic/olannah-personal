import { StatusIndicator } from '@/components';
import { messages } from '../messages';
import { ScreenFrame } from './ScreenFrame';

// Shell-owned (BRD 1.0 error row 1): wordmark, plain-language message, progress indicator. Nothing else.
// This is the initial server-rendered HTML, so it paints without JavaScript. It is replaced, never hidden.
export function SessionLoadingScreen({ slow }: { slow: boolean }) {
  return (
    <ScreenFrame>
      <StatusIndicator state="loading" label={messages.session.loadingStatus} size="lg" />
      <p className="type-heading-md" role="status">
        {slow ? messages.session.loadingSlow : messages.session.loading}
      </p>
    </ScreenFrame>
  );
}
