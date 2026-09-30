// Copies every emitted .d.ts to a .d.cts twin (with "./x.js" imports pointing
// at "./x.cjs"), so TypeScript projects that `require` this package under
// `moduleResolution: node16/nodenext` get CommonJS-flavored types.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function* declarations(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* declarations(path);
    else if (entry.name.endsWith(".d.ts")) yield path;
  }
}

for await (const file of declarations("dist")) {
  const code = await readFile(file, "utf8");
  const cjs = code
    .replace(/(from\s+["'])(\.{1,2}\/[^"']+)\.js(["'])/g, "$1$2.cjs$3")
    .replace(/(import\(["'])(\.{1,2}\/[^"']+)\.js(["']\))/g, "$1$2.cjs$3")
    .replace(/^\/\/# sourceMappingURL=.*$/m, "");
  await writeFile(file.replace(/\.d\.ts$/, ".d.cts"), cjs);
}
