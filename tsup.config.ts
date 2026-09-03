import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // tsup's bundled rollup-plugin-dts crashes against TS 7's compiler API,
  // so declarations are emitted separately via `tsc -p tsconfig.build.json`.
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ["react"],
});
