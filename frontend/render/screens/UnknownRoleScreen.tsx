import { WorkspaceRecoveryScreen } from './WorkspaceRecoveryScreen';
import { messages } from '../messages';

// BRD 1.0 UR3D: role could not be determined at all. No layout template is loaded. Distinct from an unmapped role,
// which loads the platform default layout and never reaches this screen.
export function UnknownRoleScreen({ onRetry, supportHref }: { onRetry: () => void; supportHref: string }) {
  return (
    <WorkspaceRecoveryScreen
      onRetry={onRetry}
      supportHref={supportHref}
      title={messages.unknownRole.title}
      body={messages.unknownRole.body}
    />
  );
}
