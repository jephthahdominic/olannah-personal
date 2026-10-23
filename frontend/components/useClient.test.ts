import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The component barrel is imported from server components (for example the auth layout). Any component file that uses React
// state, effects, refs, context or other client-only hooks MUST start with 'use client', or the page fails to render with a
// server-component error that unit tests under jsdom never see.
const root = __dirname;
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) files.push(full);
  }
};
walk(root);

const hasDirective = (text: string) => /^\s*(['"])use client\1;?/.test(text);

describe('client components', () => {
  it.each(files.map((f) => [f.slice(root.length + 1), f] as const))("%s declares 'use client' when it needs it", (_name, file) => {
    const text = readFileSync(file, 'utf8');
    const usesHooks = /from 'react'|from "react"/.test(text) && /\b(useState|useEffect|useLayoutEffect|useRef|useId|useMemo|useCallback|useReducer|useContext|useSyncExternalStore|useTransition|useImperativeHandle|createContext)\b/.test(text);
    if (usesHooks) expect(hasDirective(text), `${file} uses client-only React APIs but has no 'use client'`).toBe(true);
  });
});
