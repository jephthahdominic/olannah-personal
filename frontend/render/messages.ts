import type { FormErrorCode } from '@/contracts';

// The shell's own worker-facing text, in ONE catalogue keyed by message key (SDD 14.6), so copy can change under the
// content standard (BRD 1.3 OQ1, still open) without touching components. Plain language: no codes, no service names,
// no technical detail. Everything else the worker reads is supplied upstream and rendered as given.

export const messages = {
  brand: { name: 'Olannah' },

  session: {
    loading: 'Loading your workspace',
    loadingSlow: 'Login is taking longer than expected. Your workspace will appear as soon as it is ready.',
    loadingStatus: 'Loading',
  },

  context: {
    degraded: 'Your workspace is taking longer than expected to load. You can keep waiting. We are still trying.',
  },

  recovery: {
    title: 'We could not load your workspace',
    body: 'Something went wrong on our side while setting up your workspace. Nothing you were working on has been lost.',
    retry: 'Try again',
    contactSupport: 'Contact support',
    errorStatus: 'Workspace unavailable',
  },

  unknownRole: {
    title: 'Your workspace is not set up yet',
    body: 'We could not tell which role you work in, so we have not loaded a workspace. Try again, or contact support to have your role set up.',
  },

  expired: {
    title: 'Your session has ended',
    body: 'For your security you have been signed out. Any work you had not saved may need to be entered again.',
    logIn: 'Log in',
    redirecting: 'Taking you to sign in',
  },

  login: {
    title: 'Sign in to Olannah',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    expiredNotice: 'Your session ended. Sign in to continue.',
    signUpPrompt: 'New to Olannah?',
    signUpLink: 'Create an account',
    throttled: (seconds: number) => `Too many attempts. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
    // Deliberately identical for "no such account" and "wrong password" so the form cannot be used to discover accounts.
    failures: {
      invalid_credentials: 'That email and password do not match. Check them and try again.',
      locked: 'This account is locked. Contact support to get back in.',
      unavailable: 'Sign in is not available right now. Try again in a moment, or contact support.',
      network: 'We could not reach the sign in service. Check your connection and try again.',
      rate_limited: 'Too many attempts. Wait a moment, then try again.',
    },
  },

  signup: {
    title: 'Create your Olannah account',
    fullName: 'Full name',
    email: 'Work email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    passwordHelp: 'At least 12 characters. Avoid common passwords and anything from your email address.',
    submit: 'Create account',
    submitting: 'Creating account',
    signInPrompt: 'Already have an account?',
    signInLink: 'Sign in',
    // Identical whether or not the address is already registered (no account enumeration).
    doneTitle: 'Check your email',
    doneBody: 'If this address can be registered, we have sent a message with a link to verify it. Your role and access are set up after you verify.',
    backToSignIn: 'Back to sign in',
    failures: {
      unavailable: 'Account creation is not available right now. Try again in a moment, or contact support.',
      network: 'We could not reach the service. Check your connection and try again.',
      rate_limited: 'Too many attempts. Wait a moment, then try again.',
      rejected: 'We could not create an account with those details. Check them and try again.',
    },
  },

  // Plain-language text for each validation code. The contracts emit CODES only, never text and never the value typed.
  validation: {
    email_required: 'Enter your email address.',
    email_invalid: 'Enter a valid email address, like name@company.com.',
    email_too_long: 'That email address is too long.',
    password_required: 'Enter your password.',
    password_too_short: 'Use at least 12 characters.',
    password_too_long: 'That password is too long. Use 128 characters or fewer.',
    password_common: 'That password is too easy to guess. Choose a different one.',
    password_contains_email: 'Do not build your password from your email address.',
    password_mismatch: 'The passwords do not match.',
    confirm_required: 'Enter your password again to confirm it.',
    name_required: 'Enter your full name.',
    name_too_short: 'Enter your full name.',
    name_too_long: 'That name is too long. Use 80 characters or fewer.',
    name_invalid: 'Use letters, spaces, hyphens, apostrophes and periods only.',
    invalid_characters: 'That contains characters we cannot accept.',
  } satisfies Record<FormErrorCode, string>,

  nav: {
    primaryLabel: 'Main navigation',
    skipToContent: 'Skip to main content',
    more: 'More',
    moreActions: {
      ask: { title: 'Ask Olannah', description: 'Get help from the assistant' },
      feedback: { title: 'Feedback', description: 'Tell us about this screen' },
      settings: { title: 'Settings', description: 'Account and preferences' },
    },
    unavailableReason: 'This area needs a connection. It will be available when you are back online.',
    unavailableMarker: 'Needs a connection',
    degradedStart: "Some of your navigation couldn't load. Dashboard is available.",
    failed: "Navigation couldn't load. Refresh to try again.",
    recoveryDashboard: 'Dashboard',
    recoveryRefresh: 'Refresh',
    deniedNotice: "You don't have access to this area.",
    notYetAvailable: 'This is not available yet.',
  },

  settings: { title: 'Settings', name: 'Name', role: 'Role' },

  zone: {
    unavailableTitle: 'This section is unavailable',
    unavailableBody: 'We could not load this section. The rest of your workspace is not affected.',
    retry: 'Try again',
    showContext: 'Show context',
    hideContext: 'Hide context',
    contextTitle: 'Context',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Information for this section appears here once your work is assigned.',
    contextEmptyBody: 'Supporting details appear here when a job is open.',
    refreshing: 'Updating',
    refreshDelayed: 'This update is taking longer than expected. You are seeing information from earlier.',
    stale: 'Not up to date',
  },

  connection: {
    lost: 'Connection lost. You are seeing the last information we received, and anything that changes records is unavailable until it returns.',
    failed: 'We could not restore the connection. You are seeing the last information we received, and anything that changes records is unavailable.',
    retry: 'Try again',
    contactSupport: 'Contact support',
    reconnecting: 'Reconnecting',
  },

  assistant: {
    title: 'Ask Olannah',
    trigger: 'Ask Olannah',
    unreadTrigger: (n: number) => `Ask Olannah, ${n} new ${n === 1 ? 'suggestion' : 'suggestions'}`,
    close: 'Close assistant',
    inputLabel: 'Your question',
    send: 'Send',
    userName: 'You',
    assistantName: 'Olannah',
    proactive: 'Suggestion from Olannah',
    emptyTitle: 'Ask anything about your work',
    emptyBody: 'Olannah answers questions about your jobs and sites. What you see on your screen always comes first.',
    loading: 'Connecting to Olannah',
    reconnecting: 'Reconnecting to Olannah. You can read the conversation so far, but you cannot send until it returns.',
    disconnected: 'Olannah cannot be reached right now. Nothing you type is sent until the connection is back.',
    retry: 'Try again',
    notSent: 'That message was not sent because Olannah cannot be reached. It is still in the box.',
    invalid: 'Enter a message of up to 2,000 characters.',
  },

  feedback: {
    link: 'Feedback',
    title: 'Feedback',
    aboutLabel: 'About',
    fieldLabel: 'What would you like to tell us?',
    submit: 'Send feedback',
    submitting: 'Sending feedback',
    close: 'Close feedback',
    doneTitle: 'Thank you',
    doneBody: 'Your feedback was sent along with the screen you were on.',
    doneClose: 'Close',
    failedTitle: 'Your feedback was not sent',
    failedBody: 'We could not send it. What you wrote is still here. Try again in a moment.',
    retry: 'Try sending again',
    thisScreen: 'This screen',
    summary: (screen: string, viewport: string) => `${screen}, ${viewport} view`,
    validation: {
      feedback_required: 'Write a few words before you send.',
      feedback_too_long: 'That is too long. Use 2,000 characters or fewer.',
      invalid_characters: 'That contains characters we cannot accept.',
    },
  },

  checkpoint: {
    // DRAFT wording. BRD 1.4 owns the protocol and the accountability statement; plain language, no codes, no technical detail.
    title: 'A decision is needed',
    blockingNote: 'The rest of your work is paused until you decide.',
    triggeredByLabel: 'Started by',
    initializing: 'Preparing the changes for your review',
    diff: {
      heading: 'What will be written',
      targetSystem: 'Target system',
      record: 'Record',
      originatingAgent: 'Started by',
      now: 'Now',
      willBe: 'Will be',
      noCurrentValue: 'No value yet',
    },
    accountability: 'Approving sends the changes shown above to be written to the record. Your decision is recorded with your name and the time, and you are accountable for it.',
    accountabilityHeading: 'Before you decide',
    // Identical for every checkpoint and persona (BRD 1.3 section 8.7).
    acknowledgment: 'I have reviewed the proposed changes shown above.',
    approve: 'Approve changes',
    approveArmed: 'Tap again to approve',
    approveArmedAnnouncement: 'Approval is ready. Activate it again to confirm.',
    approveDisarmed: 'Approval was not confirmed.',
    reject: 'Reject changes',
    submitting: 'Submitting your decision',
    connectionLost: 'Your connection was lost. Nothing was submitted. Your decision is paused until the connection is back and the changes are checked again.',
    inactivityWarning: 'Are you still there? This decision will close soon if nothing happens, and nothing will be submitted.',
    // What the worker is told when it ends. Only a decision that reached the system is described as submitted, and never as completed.
    outcome: {
      approved: { tone: 'success', text: 'Your approval was submitted.' },
      rejected: { tone: 'info', text: 'Your rejection was submitted. No changes were made.' },
      timeout: { tone: 'info', text: 'This decision timed out. Nothing was submitted.' },
      session_abandoned: { tone: 'info', text: 'Your session ended. Nothing was submitted.' },
      render_failure: { tone: 'info', text: 'We could not show this decision. Nothing was submitted.' },
      diff_load_failure: { tone: 'info', text: 'We could not load the changes for review. Nothing was submitted.' },
      payload_mismatch: { tone: 'info', text: 'The changes no longer match what you reviewed. Nothing was submitted.' },
      upstream_mutation: { tone: 'info', text: 'The record changed while you were reviewing. Nothing was submitted.' },
      reconnection_validation_failure: { tone: 'info', text: 'We could not confirm the changes after your connection returned. Nothing was submitted.' },
      component_load_failure: { tone: 'info', text: 'We could not open this decision. Nothing was submitted.' },
      approval_submission_failure: { tone: 'info', text: 'Your approval could not be submitted. Nothing was submitted.' },
      rejection_submission_failure: { tone: 'info', text: 'Your rejection could not be submitted. Nothing was submitted.' },
    },
    announce: (triggeredBy: string, description: string) => `A decision is needed. Started by ${triggeredBy}. ${description}`,
  },

  widget: {
    headerLabel: 'Olannah Insight',
    fallbackTitle: 'Insight unavailable',
    fallbackMessage: 'This insight cannot be shown right now. Your work and history are not affected.',
  },

  history: {
    label: 'Service history',
    loading: 'Loading service history',
    emptyTitle: 'No history yet',
    emptyBody: 'Past visits for this site appear here once there are any.',
    errorTitle: 'Service history is unavailable',
    errorBody: 'We could not load the history. Your work is not affected.',
    retry: 'Try again',
    loadMore: 'Show earlier visits',
  },

  dashboard: {
    featuredLabel: 'Next job',
    queueEmptyTitle: 'Nothing queued',
    queueEmptyBody: 'Items appear here as work is assigned to you.',
    noteBy: (author: string) => `${author}:`,
  },

  shell: {
    workspaceLabel: { technician: 'Technician workspace', estimator: 'Estimator workspace', default: 'Workspace' },
    synced: 'Synced',
    updating: 'Updating',
    stale: 'Not up to date',
    syncedDescription: 'Your information is up to date',
    toastDismiss: 'Dismiss',
  },

  workspace: {
    // Placeholder shell shown once boot settles, until the technician and estimator layouts are built.
    placeholderTitle: 'Workspace ready',
    signOut: 'Sign out',
  },
} as const;
