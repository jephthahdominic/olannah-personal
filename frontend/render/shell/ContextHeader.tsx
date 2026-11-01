import type { Wire } from '@/contracts';
import { StatusIndicator, type StatusState } from '@/components';
import type { ConnectionStatus } from '@/runtime/canvas/canvasRuntime';
import { messages } from '../messages';
import styles from './ContextHeader.module.css';

// The Context Header (BRD SR26): the active job, on every screen while the context object holds an active work order. It renders ONLY what
// the context object delivers: the work order id, site name, task summary, the worker's name and role label, and the canvas connectivity.
// It has no actions, no navigation logic and no permission logic, and it never fetches or infers a field. Whether it shows is decided by
// `active_work_order` alone (SR26E): the caller passes that field in, never a URL, route or component state.
const SHAPE: Record<ConnectionStatus, StatusState> = { connecting: 'loading', connected: 'success', reconnecting: 'warning', failed: 'error' };
const LABEL: Record<ConnectionStatus, string> = {
  connecting: messages.contextHeader.connectivity.connecting,
  connected: messages.contextHeader.connectivity.connected,
  reconnecting: messages.contextHeader.connectivity.reconnecting,
  failed: messages.contextHeader.connectivity.disconnected,
};

export function ContextHeader({ workOrder, worker, connection }: { workOrder: Wire.ActiveWorkOrder; worker: Wire.Worker; connection: ConnectionStatus }) {
  return (
    <section className={styles.header} aria-label={messages.contextHeader.label}>
      <div className={styles.job}>
        <p className={`${styles.reference} type-heading-md`}>
          {workOrder.id} <span aria-hidden="true">·</span> {workOrder.site_name}
        </p>
        {workOrder.task_summary && <p className={`${styles.task} type-body`}>{workOrder.task_summary}</p>}
      </div>
      <div className={styles.meta}>
        <p className={`${styles.who} type-body-sm`}>
          <span className="visually-hidden">{messages.contextHeader.worker}: </span>
          {worker.name} <span aria-hidden="true">·</span> {worker.role_label}
        </p>
        <p className={`${styles.connectivity} type-body-sm`}>
          <StatusIndicator state={SHAPE[connection]} label={LABEL[connection]} decorative size="sm" />
          <span>{LABEL[connection]}</span>
        </p>
      </div>
    </section>
  );
}
