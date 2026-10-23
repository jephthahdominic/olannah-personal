import { DEFAULT_RUNTIME_CONFIG, RuntimeConfigSchema, type RuntimeConfig } from '@/contracts';

export interface LoadedRuntimeConfig {
  config: RuntimeConfig;
  /** True when the file was missing or invalid and compiled defaults were used. The caller logs config.invalid. */
  usedDefaults: boolean;
}

/** Loads /runtime-config.json (ADR-012). Never throws: a missing or invalid file falls back to compiled defaults. */
export async function loadRuntimeConfig(timeoutMs = 500): Promise<LoadedRuntimeConfig> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch('/runtime-config.json', { signal: controller.signal, cache: 'no-cache' });
    clearTimeout(timer);
    if (!response.ok) return { config: DEFAULT_RUNTIME_CONFIG, usedDefaults: true };
    const parsed = RuntimeConfigSchema.safeParse(await response.json());
    return parsed.success
      ? { config: parsed.data, usedDefaults: false }
      : { config: DEFAULT_RUNTIME_CONFIG, usedDefaults: true };
  } catch {
    return { config: DEFAULT_RUNTIME_CONFIG, usedDefaults: true };
  }
}
