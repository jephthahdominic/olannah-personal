// The shape of a component manifest (BRD 1.2 5.2, 5.3, 5.14 and 5.5.1 onward; SDD ADR-009 and 9.2).
//
// A manifest is the executable form of a component's specification. Each component has ONE, in a file beside it
// (Button/Button.manifest.ts). components/manifests.ts collects them, manifests.test.ts checks them, and the gallery shows them.
//
// It says, in this order:
//   jobs        what the component does for the worker, in plain words
//   contract    what data it needs (BRD 1.2 5.3): per field, its type, whether it is required, what it MEANS, how fresh it should be,
//               and what it does when the field is absent or stale. Primitives that carry no data say so, and why.
//   governance  the rules it must obey, each with the BRD section it comes from
//   plus the machine-checked fields: category, lifecycle, state dimensions, events, accessibility obligations, prohibited behaviours.

export type Category = 'foundation' | 'data-display' | 'input-control' | 'feedback-status' | 'visualization' | 'system-surface' | 'widget';
export type NA = 'not-applicable';
export const NA: NA = 'not-applicable';

/** One field of a data contract (BRD 1.2 5.3 Feature 1A). It names meaning, not just a type, and never names a data source (1B). */
export interface ContractField {
  /** The prop, or the field of a prop. */
  field: string;
  type: string;
  required: boolean;
  /** What the value MEANS to the worker. A date or a status carries several legitimate meanings, so the type alone is not enough. */
  meaning: string;
  /** How current it must be. 'As delivered' when the canvas owns freshness. 'Not specified' when the BRD is silent. */
  freshness: string;
  /** What the component does when a required field is absent or stale, or when an optional one is missing (5.3 Feature 1C). */
  whenAbsent: string;
}

export type DataContract =
  /** A primitive or surface that renders no worker data. `reason` says why, so the absence is deliberate and visible. */
  | { kind: 'none'; reason: string }
  | { kind: 'fields'; fields: readonly ContractField[] };

/** One rule from the BRD's governance requirements, in plain words, with where it comes from. */
export interface GovernanceRule {
  rule: string;
  /** For example "BRD 1.2 5.5.1 Feature 1A". */
  source: string;
}

export interface ComponentManifest {
  name: string;
  category: Category;
  /** P0 renders in the technician flow. P0.5 renders only in the estimator flow. */
  priority: 'P0' | 'P0.5';
  personas: ('technician' | 'estimator')[];
  lifecycle: 'ephemeral' | 'persistence-capable';
  /**
   * The component's job in ONE line, from the worker's point of view ("Shows a worker the jobs assigned to them"). Not a description of the
   * markup: what the person gets from it. Shown on its card in the gallery.
   */
  job: string;
  /**
   * What the component does for the worker, in one to three plain sentences. Not a restatement of the BRD's user stories: the function,
   * and where it is used.
   */
  jobs?: readonly string[];
  contract?: DataContract;
  governance?: readonly GovernanceRule[];
  /**
   * Set when the component is NOT in the BRD 1.2 catalogue (5.1.1): it was added by the build, and says why. Its governance rules are the
   * ones its category inherits, and it still needs approval through library governance.
   */
  outsideCatalogue?: string;
  /** Known differences between what the component does today and what BRD 1.2 requires of it. Written down so they are not hidden. */
  gaps?: readonly string[];
  dimensions: { data: readonly string[] | NA; interaction: readonly string[] | NA; runtime: readonly string[] | NA };
  events: readonly string[];
  a11y: { contrast: string | NA; touchTarget: string | NA; focus: string | NA; announcement: string | NA; reducedMotion: string | NA };
  prohibited: readonly string[];
}

/** Identity function that type-checks a manifest where it is written. */
export const defineComponent = (manifest: ComponentManifest): ComponentManifest => manifest;

/** A manifest is fully specified when it says what the component does, what data it needs, and which rules bind it. */
export const isSpecified = (m: ComponentManifest): boolean => (m.jobs?.length ?? 0) > 0 && m.contract !== undefined && (m.governance?.length ?? 0) > 0;
