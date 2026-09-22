import { mkdir, writeFile } from 'node:fs/promises';
import { runScenario, lineupCsv, projectionCsv, SCENARIOS } from '../src/demo.mjs';

const directory = new URL('../artifacts/demo/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const scenario of SCENARIOS) {
  const run = runScenario(scenario.id);
  await writeFile(new URL(`${scenario.id}.json`, directory), JSON.stringify(run, null, 2) + '\n');
  if (run.quality.ok && run.result?.complete) {
    await writeFile(new URL(`${scenario.id}-projections.csv`, directory), projectionCsv(run));
    await writeFile(new URL(`${scenario.id}-lineups.csv`, directory), lineupCsv(run));
    console.log(
      `${scenario.id}: ${run.players.length} fictional players, ${run.result.lineups.length} complete research lineups, ${run.result.nodes} search nodes.`,
    );
  } else
    console.log(
      `${scenario.id}: correctly BLOCKED — ${run.quality.errors.join(' ') || run.result.reason}`,
    );
}
console.log(
  'Artifacts: artifacts/demo/ (gitignored). All data are synthetic; no live source or manual input required.',
);
