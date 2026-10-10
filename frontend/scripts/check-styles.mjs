// Token-only styling check (BRD 1.2 5.2 Feature 5, BRD 1.3 section 13.3, SDD 9.3).
// Fails on hard-coded colors, z-index, font families, shadows, literal motion timings, and unknown var(--token) names.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scanDirs = ['app', 'components', 'render'];
const exts = ['.css', '.tsx'];
const skip = new Set(['node_modules', '.next', 'fonts']);
// Custom properties that are not design tokens but are legitimately set by the framework.
const externalVars = new Set(['--font-inter', '--font-inter-tight']);

const tokenSrc = readFileSync(join(root, 'tokens/tokens.generated.ts'), 'utf8');
const tokens = new Set([...tokenSrc.matchAll(/"([a-z0-9-]+)"/g)].map((m) => `--${m[1]}`));

// [pattern, message, applies to]. A hex color is any #abc in CSS, but in TSX only a QUOTED hex literal, so text such as
// "Northgate Grocers #4830" is not mistaken for a color.
const rules = [
  [/#[0-9a-fA-F]{3,8}\b/, 'hard-coded hex color', '.css'],
  [/['"`]#[0-9a-fA-F]{3,8}['"`]/, 'hard-coded hex color', '.tsx'],
  [/\b(rgb|rgba|hsl|hsla)\(/, 'hard-coded color function'],
  [/z-index\s*:\s*-?\d/, 'literal z-index (use a --z-* token via a portal host)'],
  [/font-family\s*:(?!\s*var\()/, 'literal font-family (use a type token)'],
  [/box-shadow\s*:(?!\s*none)/, 'box-shadow (the system has no elevation or shadows)'],
  [/\b\d+ms\b/, 'literal duration (use a --motion-* token)'],
];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (exts.some((e) => name.endsWith(e))) files.push(full);
  }
};
for (const d of scanDirs) walk(join(root, d));

let problems = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8').split('\n');
  text.forEach((line, i) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
    for (const [re, msg, only] of rules) {
      if (only && !file.endsWith(only)) continue;
      if (re.test(line)) {
        console.error(`${relative(root, file)}:${i + 1}  ${msg}\n    ${line.trim()}`);
        problems++;
      }
    }
    for (const m of line.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!tokens.has(m[1]) && !externalVars.has(m[1])) {
        console.error(`${relative(root, file)}:${i + 1}  unknown token ${m[1]} (local tokens are not permitted)`);
        problems++;
      }
    }
  });
}
if (problems) {
  console.error(`\ncheck-styles: ${problems} problem(s)`);
  process.exit(1);
}
console.log(`check-styles: ${files.length} files clean`);
