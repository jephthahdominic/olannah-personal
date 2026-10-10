'use client';

import { useEffect, type ReactNode } from 'react';
import { InsightPayloadSchema, WidgetEnvelopeSchema, isSupportedWidget, type InsightPayload, type WidgetEnvelope } from '@/contracts';
import { DegradedBanner } from '../DegradedBanner/DegradedBanner';
import { Icon } from '../Icon/Icon';
import { Label } from '../Label/Label';
import { StatusPill } from '../StatusPill/StatusPill';
import { Surface } from '../Surface/Surface';
import { ErrorBoundary } from '../utils/ErrorBoundary';
import styles from './WidgetContainer.module.css';

// WidgetContainer is the ONLY place AI insight-layer output becomes visible (BRD 1.2 5.11). The insight layer owns the
// payload and the schema; the canvas owns rendering and failure. The pipeline is:
//   1 type and version supported?  ->  2 payload structurally valid?  ->  3 renderer exists?  ->  4 render
// An unknown type, an unsupported version or an invalid payload renders a defined fallback with a SUPPLIED message. It never
// crashes, blanks, or renders a best guess, and the fallback never shows a version, type or code to the worker.
//
// Widgets are DISPLAY-ONLY at P0: no action control, no write, no workflow mutation. Renderers compose library components
// and tokens only. The container derives no business meaning, ranks nothing, and infers no degradation: degraded renders
// only when supplied.

export type WidgetDiagnostic = 'unsupported' | 'invalid' | 'render_error';

export interface WidgetContainerProps {
  /** The widget exactly as delivered. It is validated here, never trusted. */
  widget: unknown;
  /** The widget's own header text, supplied (for example "Olannah Insight"). */
  headerLabel: string;
  /** Supplied worker-facing fallback text for anything that cannot be rendered. No schema, type or code. */
  fallbackTitle: string;
  fallbackMessage: string;
  /** Receives WHY a widget could not render, so unsupported (a version problem) and invalid (an upstream defect) stay
   *  distinguishable in diagnostics even though the worker sees the same fallback. Not an interaction event. */
  onDiagnostic?: (reason: WidgetDiagnostic) => void;
}

type Inspection = { kind: 'ok'; envelope: WidgetEnvelope; insight: InsightPayload } | { kind: 'unsupported' | 'invalid' };

function inspect(widget: unknown): Inspection {
  const envelope = WidgetEnvelopeSchema.safeParse(widget);
  if (!envelope.success) return { kind: 'invalid' };
  const { type, schemaVersion } = envelope.data;
  // 1. Is this type and version in the shared contract's supported set?
  if (!isSupportedWidget(type, schemaVersion)) return { kind: 'unsupported' };
  // 2. Does the payload conform structurally? (Validation says whether it can be RENDERED, not whether it is TRUE.)
  const insight = InsightPayloadSchema.safeParse(envelope.data.payload);
  if (!insight.success) return { kind: 'invalid' };
  return { kind: 'ok', envelope: envelope.data, insight: insight.data };
}

export function WidgetContainer({ widget, headerLabel, fallbackTitle, fallbackMessage, onDiagnostic }: WidgetContainerProps) {
  const result = inspect(widget);
  const fallback = (reason: WidgetDiagnostic) => <WidgetFallback title={fallbackTitle} message={fallbackMessage} headerLabel={headerLabel} reason={reason} onDiagnostic={onDiagnostic} />;

  if (result.kind !== 'ok') return fallback(result.kind);
  // 3 and 4. Render inside the widget's own boundary: a renderer that throws shows the fallback, not a broken page.
  return (
    <ErrorBoundary onError={() => onDiagnostic?.('render_error')} fallback={() => fallback('render_error')}>
      <InsightCard insight={result.insight} headerLabel={headerLabel} degradedMessage={result.envelope.condition === 'degraded' ? result.envelope.degradedMessage : undefined} />
    </ErrorBoundary>
  );
}

function Header({ headerLabel, children }: { headerLabel: string; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <span className={styles.mark} aria-hidden="true">
        <Icon name="sparkles" size="md" />
      </span>
      <Label text={headerLabel} />
      {children}
    </div>
  );
}

function InsightCard({ insight, headerLabel, degradedMessage }: { insight: InsightPayload; headerLabel: string; degradedMessage?: string }) {
  return (
    <Surface role="panel" padding={4} className={styles.card}>
      <Header headerLabel={headerLabel}>{insight.label && <StatusPill label={insight.label} tone="neutral" />}</Header>
      {/* Degraded renders ONLY when it was supplied with the widget. It is never inferred from a missing field. */}
      {degradedMessage && <DegradedBanner message={degradedMessage} />}
      <p className="type-heading-md">{insight.title}</p>
      <p className={`${styles.body} type-body`}>{insight.body}</p>
      {insight.evidence && <p className={`${styles.evidence} type-body-sm`}>{insight.evidence}</p>}
    </Surface>
  );
}

function WidgetFallback({ title, message, headerLabel, reason, onDiagnostic }: { title: string; message: string; headerLabel: string; reason: WidgetDiagnostic; onDiagnostic?: (r: WidgetDiagnostic) => void }) {
  // Reported once when the fallback mounts, with the real reason. The worker-facing text is the same for all of them.
  return (
    <Surface role="panel" padding={4} className={styles.card}>
      <ReportOnce reason={reason} onDiagnostic={onDiagnostic} />
      <Header headerLabel={headerLabel} />
      <p className="type-heading-md">{title}</p>
      <p className={`${styles.body} type-body`}>{message}</p>
    </Surface>
  );
}

function ReportOnce({ reason, onDiagnostic }: { reason: WidgetDiagnostic; onDiagnostic?: (r: WidgetDiagnostic) => void }) {
  useEffect(() => {
    // render_error is already reported by the boundary.
    if (reason !== 'render_error') onDiagnostic?.(reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report a given reason once per mount
  }, [reason]);
  return null;
}

export type { WidgetEnvelope };
