import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { checkSource } from '../src/source-health.mjs';

const root = new URL('../', import.meta.url);
const catalogue = JSON.parse(await readFile(new URL('research/catalogue.json', root), 'utf8'));
const rows = [];
for (const source of catalogue.sources) {
  const result = await checkSource(source);
  rows.push(result);
  console.log(`${source.id}: ${result.status}`);
  if (source.monitor) await pause(500); // Low volume; no parallel scraping and no retry after denials.
}
const directory = new URL('artifacts/', root);
await mkdir(directory, { recursive: true });
const report = {
  schemaVersion: 1,
  statement:
    'Public-document availability only. Never changes source observation dates or semantic review status. LineStar monitoring is disabled.',
  snapshotReviewedOn: catalogue.reviewedOn,
  results: rows,
};
await writeFile(new URL('source-health.json', directory), JSON.stringify(report, null, 2) + '\n');
const problems = rows.filter(
  (r) => !['skipped-policy', 'reachable-not-reverified'].includes(r.status),
);
console.log(
  `Report: artifacts/source-health.json. ${problems.length} availability issues flagged; claims have not been re-verified.`,
);
if (problems.length) process.exitCode = 1;
