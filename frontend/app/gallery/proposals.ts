// Everything the build contains that no BRD names. The BRDs are the rule book (BRD 1.2 and 1.3 are the only source of components, tokens and
// type); anything below was built from an approved Figma design or from the build's own judgement, and waits here for a ruling by the spec
// team. Nothing on this page is part of the component library. When a BRD names an item, it moves into the library and leaves this file.

export interface Proposal {
  id: string;
  title: string;
  /** What it is, in plain words. */
  what: string;
  /** What needed it. */
  neededBy: string;
  /** What the BRDs say, or do not say, about it. */
  gap: string;
  /** The decision wanted from the spec team. */
  question: string;
}

export const COMPONENT_PROPOSALS: Readonly<Record<string, Omit<Proposal, 'id' | 'title'>>> = {
  StatTile: {
    what: 'One supplied figure with a label and an optional caption.',
    neededBy: 'The Dashboard design (jobs today, late, open).',
    gap: 'BRD 1.2 names KeyValue and HealthBadge for a single value. It has no summary figure tile.',
    question: 'Is a summary tile wanted, or should the Dashboard use KeyValue?',
  },
  Avatar: {
    what: 'A circle with the worker\'s initials, or a person glyph when none are supplied.',
    neededBy: 'The topbar in the approved designs.',
    gap: 'BRD 1.2 has no avatar. BRD 1.1 (Navigation), which would own the topbar, was not provided.',
    question: 'Does the topbar show the worker, and with what component?',
  },
  PasswordInput: {
    what: 'A text field for a password with a show and hide toggle.',
    neededBy: 'The Login and Sign-up screens.',
    gap: 'BRD 1.2 has TextInput only. No BRD covers sign-in screens or a masked field.',
    question: 'Is a masked input part of the library, or a TextInput variant?',
  },
  TextArea: {
    what: 'Multi-line free-text entry.',
    neededBy: 'Nothing yet. Built in expectation of notes and feedback forms.',
    gap: 'BRD 1.2 has TextInput only.',
    question: 'Is multi-line entry wanted? If not, this is removed.',
  },
};

export interface ProposedToken {
  token: string;
  value: string;
  used: string;
  gap: string;
  inBuildNow: string;
}

// Sampled from the Figma designs, never from BRD 1.3. REMOVED from the build: the build uses the BRD 1.3 tokens in the last column instead.
export const TOKEN_PROPOSALS: readonly ProposedToken[] = [
  { token: 'color-border-subtle', value: '#D7D5CE', used: 'Card, list and divider lines (31 places).', gap: 'BRD 1.3 7.1.1 names a --border token (and the Primary Content Zone section says cards are raised by "border definition"), but no section 3 colour table gives it a value. The only border colour BRD 1.3 states is Warm Slate, for the acknowledgment container.', inBuildNow: 'color-brand-secondary (Warm Slate)' },
  { token: 'color-border-strong', value: '#B9B6AD', used: 'Input, menu and overlay outlines (10 places).', gap: 'BRD 1.3 7.1.1 names --border-strong (1.5px, for the Context Header), but no section 3 colour table gives it a value.', inBuildNow: 'color-brand-secondary (Warm Slate)' },
  { token: 'color-semantic-warning-surface', value: '#FBF0E3', used: 'Tinted warning banners, pills and alerts.', gap: 'BRD 1.3 says degraded states use the semantic warning token. It defines no tinted surface.', inBuildNow: 'color-surface-card with a color-semantic-warning border' },
  { token: 'color-semantic-error-surface', value: '#F9E9E6', used: 'Tinted error banners, pills and alerts.', gap: 'As above, for error.', inBuildNow: 'color-surface-card with a color-semantic-error border' },
  { token: 'color-semantic-success-surface', value: '#E7F2E8', used: 'Success pills and toasts.', gap: 'As above, for success.', inBuildNow: 'color-surface-card with a color-semantic-success border' },
  { token: 'color-semantic-checkpoint-surface', value: '#F4EEE2', used: 'Checkpoint pills and the accountability box.', gap: 'As above, for checkpoint.', inBuildNow: 'color-surface-card with a color-semantic-checkpoint border' },
  { token: 'color-semantic-warning-text', value: '#7B491E', used: 'Warning text that passes contrast on a tint.', gap: 'The base warning colour is 3.79:1 on White, which fails AA for small text. BRD 1.3 defines no darker warning text colour.', inBuildNow: 'color-text-primary' },
  { token: 'color-surface-disabled', value: '#E3E1DB', used: 'Not used.', gap: 'BRD 1.3 8.2 says disabled is reduced opacity, not a different surface.', inBuildNow: 'Reduced opacity (already how Button works)' },
  { token: 'color-insight-accent', value: '#5B7FA6', used: 'The insight card mark.', gap: 'BRD 1.3 reserves the data-visualisation palette for charts. No insight colour is defined.', inBuildNow: 'color-brand-primary' },
  { token: 'color-insight-border', value: '#CFC5E5', used: 'The insight card outline.', gap: 'As above.', inBuildNow: 'color-brand-secondary' },
];

export const SCREEN_PROPOSALS: readonly Proposal[] = [
  { id: 'dashboard', title: 'Dashboard screen', what: 'Greeting, next job, today\'s schedule and a summary row.', neededBy: 'Figma frame "03 Dashboard".', gap: 'BRD 1.0 defines the zones (alerts, work order, steps, actions, history). It does not define a Dashboard screen or the data for one. Mock mode builds it from a proposed `dashboard` zone (PROPOSED_DASHBOARD_ZONE.md). The practice API sends none.', question: 'Is there a Dashboard screen, and which zone and fields deliver it?' },
  { id: 'work-orders', title: 'Work Orders screen', what: 'The worker\'s jobs, grouped, with a "show more" footer.', neededBy: 'Figma frame "04 Work Orders".', gap: 'Same as above, with a proposed `work_orders` zone. How further jobs are requested is not defined.', question: 'Is there a Work Orders screen, and how are more jobs requested?' },
  { id: 'context-header', title: 'Context Header hidden on the Dashboard', what: 'The design shows no Context Header on the Dashboard.', neededBy: 'Figma frame "03 Dashboard".', gap: 'BRD 1.0 SR26 says the Context Header shows on every screen while a job is active.', question: 'Which wins, the design or SR26?' },
  { id: 'topbar', title: 'Topbar and page band', what: 'A wordmark topbar, a dark band under it with the page title.', neededBy: 'The approved designs.', gap: 'BRD 1.1 (Navigation) was not provided, and BRD 1.0 does not specify a topbar.', question: 'Please share BRD 1.1, or confirm the topbar.' },
  { id: 'assembling', title: 'Assembling screen', what: 'The shell with placeholders while the workspace builds.', neededBy: 'Figma frame "02 Dashboard assembling".', gap: 'BRD 1.0 specifies a loading screen with a progress indicator (error row 1). It does not describe a skeleton shell.', question: 'Loading screen only, or the skeleton shell?' },
  { id: 'auth', title: 'Login and Sign-up screens', what: 'Sign-in with email and password, and sign-up.', neededBy: 'The mock identity provider used for development.', gap: 'Sign-in belongs to the identity provider. No BRD describes these screens.', question: 'Does the canvas own any sign-in screen?' },
];

// What is still different from BRD 1.2 in components that ARE in it. The build removed every other addition (see CHECKLIST.md); these remain
// because removing them would drop data the contract delivers or break a BRD 1.3 rule, and each needs a ruling.
export const VARIANT_PROPOSALS: readonly { component: string; addition: string }[] = [
  { component: 'HistoryList', addition: 'Records carry a status, flags and sources. They are part of the history the API delivers, and BRD 1.2 5.6 leaves the row template to be supplied, but does not name them.' },
  { component: 'Link', addition: 'A tone for a link on an Evergreen surface, so it uses Warm Cream (BRD 1.3 says no other text colour is used on Evergreen). BRD 1.2 5.5 lists no such prop.' },
  { component: 'Icon', addition: 'Three glyphs added to the allowed Tabler outline set: arrow-right, menu and user.' },
];
