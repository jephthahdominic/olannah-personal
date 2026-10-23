import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architecture rules (SDD 9.3). Absence requirements in the BRDs ("a code review audit confirms no...")
// are enforced here as lint rules, not review comments.
//
// Layers and allowed direction:
//   tokens, contracts  -> import nothing from the app
//   clients            -> contracts
//   runtime            -> clients (interfaces), contracts
//   components         -> tokens, contracts (types). NO clients, runtime, render
//   render             -> components, contracts, runtime (read-only state). NO clients
//   app/               -> everything

const networkGlobals = ["fetch", "XMLHttpRequest", "EventSource", "WebSocket"].map((name) => ({
  name,
  message: "Only code under clients/ may open network connections (BRD 1.2 Assumption 2; 1.0 SR23).",
}));
const storageGlobals = ["localStorage", "sessionStorage", "indexedDB"].map((name) => ({
  name,
  message: "Browser storage is banned outside clients/mock/mockIdp.ts. State is memory-only (ADR-010; BRD 1.0 non-goal 10).",
}));
const storageProps = ["localStorage", "sessionStorage", "indexedDB"].map((property) => ({
  object: "window",
  property,
  message: "Browser storage is banned outside clients/mock/mockIdp.ts (ADR-010).",
}));
const restrictedProps = [
  ...storageProps,
  { object: "document", property: "cookie", message: "No cookie access in application code (ADR-010)." },
  { object: "navigator", property: "sendBeacon", message: "Only the telemetry client under clients/ may send beacons." },
];

const layerImports = (label, groups) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: groups.map(([group, why]) => ({ group, message: `${label} must not import this layer: ${why}` })),
    },
  ],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  { rules: { "react/no-danger": "error" } },

  // Everything except clients, legacy lib, scripts and tests: no network, no storage.
  {
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["clients/**", "lib/**", "scripts/**", "**/*.test.{ts,tsx}", "tests/**"],
    rules: {
      "no-restricted-globals": ["error", ...networkGlobals, ...storageGlobals],
      "no-restricted-properties": ["error", ...restrictedProps],
    },
  },
  // clients: network allowed, storage still banned (except the mock IdP module below).
  {
    files: ["clients/**/*.{ts,tsx}"],
    ignores: ["clients/mock/mockIdp.ts", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", ...storageGlobals],
      "no-restricted-properties": ["error", ...restrictedProps.filter((p) => p.property !== "sendBeacon")],
    },
  },

  // Layer boundaries.
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: layerImports("components", [
      [["@/clients", "@/clients/**", "**/clients", "**/clients/**"], "components render props and never touch the network"],
      [["@/runtime", "@/runtime/**", "**/runtime", "**/runtime/**"], "components hold presentation state only"],
      [["@/render", "@/render/**", "**/render", "**/render/**"], "components do not depend on the shell"],
    ]),
  },
  {
    files: ["render/**/*.{ts,tsx}"],
    rules: layerImports("render", [
      [["@/clients", "@/clients/**", "**/clients", "**/clients/**"], "the render path has no network access"],
    ]),
  },
  {
    files: ["runtime/**/*.{ts,tsx}"],
    rules: layerImports("runtime", [
      [["@/components", "@/components/**", "@/render", "@/render/**"], "runtime is framework-free state, not UI"],
    ]),
  },
  {
    files: ["contracts/**/*.{ts,tsx}", "tokens/**/*.{ts,tsx}"],
    rules: layerImports("contracts and tokens", [
      [["@/clients/**", "@/runtime/**", "@/components/**", "@/render/**", "@/app/**"], "contracts and tokens depend on nothing in the app"],
    ]),
  },

  // Navigation never reads the worker's role (BRD 1.1 UR3D, SR1A). Applies once navigation code exists.
  {
    files: ["render/navigation/**/*.{ts,tsx}", "components/Nav*/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Identifier[name=/^(resolvedRole|resolved_role)$/]", message: "Navigation must not read the role (BRD 1.1)." },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "tokens/tokens.generated.ts"]),
]);

export default eslintConfig;
