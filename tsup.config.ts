import { readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

// No newline, so the sourcemaps (generated before this is added) stay aligned.
const USE_CLIENT = '"use client";';

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  format: ["esm", "cjs"],
  // tsup's bundled rollup-plugin-dts crashes against TS 7's compiler API,
  // so declarations are emitted separately via `tsc -p tsconfig.build.json`.
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ["react"],
  // Marks the main entry as client code for React Server Components (Next.js
  // App Router), so the hook and components can be imported without a
  // wrapper file. esbuild drops directives when bundling, so it's added
  // after the build. The `core` entry has no React code and stays server-safe.
  async onSuccess() {
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const code = await readFile(file, "utf8");
      if (!code.startsWith(USE_CLIENT)) await writeFile(file, USE_CLIENT + code);
    }
  },
});
