// Contrast gate (BRD 1.3 section 11.1, SDD 9.4). Computes WCAG ratios from the real token values.
// P0 pairs fail the build when under target. P1 pairs are reported as warnings.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const c = JSON.parse(readFileSync(join(root, 'tokens/tokens.json'), 'utf8')).color;

const lum = (hex) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Known spec conflicts awaiting a Design decision. Reported on every run, never silently dropped.
// Remove an entry only when Design resolves it (and record the decision in BRD 1.3 first).
const known = {
  'Focus outline (Moss Gold) on Warm Cream':
    'BRD 1.3 section 8.1 mandates a Moss Gold focus ring; section 11.1 requires 3:1 against the adjacent surface. Moss Gold is 2.90:1 on Warm Cream.',
  'Focus outline (Moss Gold) on Sage Mist':
    'Same conflict. Moss Gold is 2.77:1 on Sage Mist (context zone). Options for Design: darker ring token, or a two-tone ring.',
  'Base warning color as small text on White':
    'Design uses the base amber for small labels ("2 need attention today", "Required"). 3.79:1 fails AA at body size. Use color-semantic-warning-text for text and keep the base amber for shapes and borders.',
  'Base Moss Gold as small text on Warm Cream':
    'Moss Gold is 2.90:1 on cream. Do not use it for text. Use it for shapes, borders and filled buttons with dark text (5.51:1).',
  'Success text on success surface':
    'Green on its own tint is below 4.5:1. Needs a darker success text token or dark text with a green shape. Design decision.',
};

// [description, foreground token, background token, minimum, priority]
const pairs = [
  ['Primary text on Warm Cream', 'color-text-primary', 'color-surface-workspace', 4.5, 'P0'],
  ['Primary text on White', 'color-text-primary', 'color-surface-card', 4.5, 'P0'],
  ['Primary text on Sage Mist', 'color-text-primary', 'color-surface-panel', 4.5, 'P0'],
  ['Secondary text (Warm Slate) on Warm Cream', 'color-text-secondary', 'color-surface-workspace', 4.5, 'P0'],
  ['Secondary text (Warm Slate) on White', 'color-text-secondary', 'color-surface-card', 4.5, 'P0'],
  ['Secondary text (Warm Slate) on Sage Mist', 'color-text-secondary', 'color-surface-panel', 4.5, 'P0'],
  ['Warm Cream on Evergreen Dark (nav)', 'color-text-on-chrome', 'color-surface-chrome', 4.5, 'P0'],
  ['Warm Cream on Evergreen (primary button)', 'color-text-on-chrome', 'color-brand-primary', 4.5, 'P0'],
  ['Warm Cream on Evergreen Hover (button hover)', 'color-text-on-chrome', 'color-brand-primary-hover', 4.5, 'P0'],
  ['Moss Gold indicator on Evergreen Dark (non-text)', 'color-brand-accent', 'color-surface-chrome', 3, 'P0'],
  ['Focus outline (Moss Gold) on Warm Cream', 'color-brand-accent', 'color-surface-workspace', 3, 'P0'],
  ['Focus outline (Moss Gold) on White', 'color-brand-accent', 'color-surface-card', 3, 'P0'],
  ['Focus outline (Moss Gold) on Sage Mist', 'color-brand-accent', 'color-surface-panel', 3, 'P0'],
  ['Success indicator on White', 'color-semantic-success', 'color-surface-card', 3, 'P0'],
  ['Warning indicator on White', 'color-semantic-warning', 'color-surface-card', 3, 'P0'],
  ['Error indicator on White', 'color-semantic-error', 'color-surface-card', 3, 'P0'],
  ['Checkpoint indicator on White', 'color-semantic-checkpoint', 'color-surface-card', 3, 'P0'],
  // PROPOSED tokens sampled from the approved designs (pending BRD 1.3 update).
  ['Warning text (dark amber) on warning surface', 'color-semantic-warning-text', 'color-semantic-warning-surface', 4.5, 'P0'],
  ['Secondary text on warning surface', 'color-text-secondary', 'color-semantic-warning-surface', 4.5, 'P0'],
  ['Secondary text on error surface', 'color-text-secondary', 'color-semantic-error-surface', 4.5, 'P0'],
  ['Error text on error surface', 'color-semantic-error', 'color-semantic-error-surface', 4.5, 'P0'],
  ['Success text on success surface', 'color-semantic-success', 'color-semantic-success-surface', 4.5, 'P0'],
  ['Primary text on success surface', 'color-text-primary', 'color-semantic-success-surface', 4.5, 'P0'],
  ['Primary text on checkpoint surface', 'color-text-primary', 'color-semantic-checkpoint-surface', 4.5, 'P0'],
  // Inactive (disabled) controls are exempt from WCAG 1.4.3, so this is informational (P1), not a gate.
  ['Secondary text on disabled surface (informational)', 'color-text-secondary', 'color-surface-disabled', 4.5, 'P1'],
  ['Base warning color as small text on White', 'color-semantic-warning', 'color-surface-card', 4.5, 'P0'],
  ['Base Moss Gold as small text on Warm Cream', 'color-brand-accent', 'color-surface-workspace', 4.5, 'P0'],
  ['Checkpoint text, dark on Moss Gold (AAA)', 'color-text-primary', 'color-semantic-checkpoint', 7, 'P1'],
  ['Checkpoint text, white on Moss Gold (AAA)', 'color-surface-card', 'color-semantic-checkpoint', 7, 'P1'],
];

let failed = 0;
for (const [desc, fg, bg, min, pri] of pairs) {
  const r = ratio(c[fg], c[bg]);
  const ok = r >= min;
  const isKnown = !ok && known[desc];
  const tag = ok ? 'pass' : isKnown ? 'KNWN' : pri === 'P0' ? 'FAIL' : 'warn';
  if (!ok && pri === 'P0' && !isKnown) failed++;
  console.log(`${tag.padEnd(4)} ${pri}  ${r.toFixed(2).padStart(5)}:1 (need ${min}:1)  ${desc}`);
  if (isKnown) console.log(`           known issue: ${known[desc]}`);
}
if (failed) {
  console.error(`\ncontrast gate: ${failed} P0 pair(s) below target`);
  process.exit(1);
}
console.log('\ncontrast gate: no new P0 failures (known issues listed above need a Design decision)');
