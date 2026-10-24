import { defineConfig } from "tsup";

/**
 * Each entry is bundled standalone (splitting: false) — the core is tiny, so
 * inlining it per entry keeps consumers and CDN loaders simple. The react
 * peer dependency is externalized by tsup automatically.
 */
export default defineConfig([
  {
    // React adapter is the default entry
    entry: { index: "src/react/index.tsx" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    target: "es2020",
    clean: true,
  },
  {
    entry: { core: "src/core/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    target: "es2020",
  },
]);
