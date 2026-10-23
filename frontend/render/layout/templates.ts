import { messages } from '../messages';
import type { LayoutTemplate, ZoneSpec } from './types';

// Persona layout templates. They are data: the three personas below share structure today, and differ only by id.
// A new persona adds a template here (and registers any new components); orchestration code never changes.

const primary: ZoneSpec = {
  id: 'primary',
  role: 'primary',
  surface: 'card',
  content: ['DestinationContent'],
  unavailable: { title: messages.zone.unavailableTitle, body: messages.zone.unavailableBody, retry: true },
  empty: { title: messages.zone.emptyTitle, body: messages.zone.emptyBody },
  persistence: 'persistence-capable-host',
};

const context: ZoneSpec = {
  id: 'context',
  role: 'context',
  surface: 'panel',
  content: ['ContextContent'],
  unavailable: { title: messages.zone.unavailableTitle, body: messages.zone.unavailableBody, retry: true },
  empty: { title: messages.zone.contextTitle, body: messages.zone.contextEmptyBody },
  collapsesOn: 'mobile',
};

function standard(id: string): LayoutTemplate {
  return {
    id,
    schemaVersion: '1.0',
    zones: [primary, context],
    placements: {
      // Primary content is always fully visible. Context is the first thing to collapse.
      mobile: [
        { zoneId: 'primary', region: 'main' },
        { zoneId: 'context', region: 'collapsible' },
      ],
      tablet: [
        { zoneId: 'primary', region: 'main' },
        { zoneId: 'context', region: 'aside' },
      ],
      desktop: [
        { zoneId: 'primary', region: 'main' },
        { zoneId: 'context', region: 'aside' },
      ],
    },
  };
}

export const TEMPLATES: Readonly<Record<string, LayoutTemplate>> = {
  technician: standard('technician'),
  estimator: standard('estimator'),
  // The platform default layout, used for a role that is known but has no registered layout (BRD 1.0 UR3C).
  default: standard('default'),
};

export function getTemplate(layoutId: string): LayoutTemplate {
  return TEMPLATES[layoutId] ?? TEMPLATES.default;
}
