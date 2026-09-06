/**
 * Copy the analysis outputs into the app's public folder.
 *
 * The notebook writes to data/processed/, the app serves from
 * web/public/data/. Keeping those in step by hand was a real source of bugs —
 * a forgotten copy left the app fetching a file that did not exist and it
 * rendered a blank screen. This runs automatically before dev and build, so
 * the app can never be served against stale or missing data, and the copies
 * are generated rather than committed twice.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "data", "processed");
const destination = join(here, "..", "public", "data");

if (!existsSync(source)) {
  console.error(
    `[sync-data] ${source} not found.\n` +
      "            Run the analysis notebook first — see the README.",
  );
  process.exit(1);
}

mkdirSync(destination, { recursive: true });

const files = readdirSync(source).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error(`[sync-data] no JSON files in ${source}`);
  process.exit(1);
}

for (const file of files) {
  copyFileSync(join(source, file), join(destination, file));
}

console.log(`[sync-data] copied ${files.length} file(s) into public/data`);
