import type { SurfaceRole } from '@/components';
import type { Viewport } from '@/tokens/tokens.generated';

// A layout template is DATA, not code (BRD 1.0 SR19, SDD 6.2): which zones exist, where they sit at each breakpoint,
// and which component types map to each zone. Adding a persona adds a template, never shell logic.

export type ZoneId = string;
/** A canonical component name resolved through the component registry. */
export type ComponentRef = string;

export interface UnavailableSpec {
  /** Plain-language text, SUPPLIED, never generated from a code. REQUIRED: see ZoneSpec. */
  title: string;
  body: string;
  /** Whether a retry is possible. If not, the zone says so plainly rather than offering a dead button. */
  retry: boolean;
}

export interface EmptySpec {
  /** Why the zone is empty and what would cause data to appear. Never blank (BRD 1.0 section 6). */
  title: string;
  body: string;
}

export interface ZoneSpec {
  id: ZoneId;
  /** The zone's heading (level 2), so the page has a heading structure and each zone can be found by it. Registered text, never a code. */
  title: string;
  role: 'primary' | 'context';
  /** Fixed to the zone's structural role, not its content (BRD 1.3 section 7.2). */
  surface: SurfaceRole;
  content: ComponentRef[];
  /**
   * REQUIRED, not optional. "A section with no defined unavailable message is not shippable" (BRD 1.0 UR5A) becomes a
   * compile error rather than a deployment checklist item. A checklist is still produced as release evidence.
   */
  unavailable: UnavailableSpec;
  empty: EmptySpec;
  /** False when the zone's own content carries its heading (the Dashboard's greeting), so the host does not add one. */
  showTitle?: boolean;
  /** True when the zone's content shows its own refresh and freshness indicators in its own place (the Dashboard), so the host adds none. */
  selfIndicates?: boolean;
  /** False when a lost connection is shown by the banner alone and the zone adds no "not up to date" marker of its own (the Work Orders design). */
  staleMarker?: boolean;
  /** The context zone collapses to an expandable section on mobile (BRD 1.3 section 6.2). */
  collapsesOn?: 'mobile';
  /** Whether the shell may host persistence-capable components here. The shell, never a component, decides. */
  persistence?: 'ephemeral' | 'persistence-capable-host';
}

export type ZoneRegion = 'main' | 'aside' | 'collapsible';

export interface ZonePlacement {
  zoneId: ZoneId;
  region: ZoneRegion;
}

export interface LayoutTemplate {
  /** Matches the layout_config identifier delivered in the context object. */
  id: string;
  schemaVersion: string;
  zones: ZoneSpec[];
  /** The Dashboard zone, when the context supplies one. It is its own screen, so it is not in the placements. */
  dashboard?: ZoneSpec;
  /** The Work Orders zone, when the context supplies one. Also its own screen. */
  workOrders?: ZoneSpec;
  placements: Record<Viewport, ZonePlacement[]>;
}
