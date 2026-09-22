import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { validateCatalogue } from '../src/catalogue.mjs';
import { renderTokens, auditMarkdown, handoffMarkdown } from '../src/render.mjs';
import { runScenario, projectionCsv, lineupCsv } from '../src/demo.mjs';
import { toCsv } from '../src/engine.mjs';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const data = JSON.parse(await read('research/catalogue.json'));
const audit = JSON.parse(await read('research/legacy-audit.json'));
const health = JSON.parse(await read('research/source-health.json'));
const validation = validateCatalogue(data, audit);
if (validation.errors.length) throw new Error(validation.errors.join('\n'));
const run = runScenario('baseline');
if (!run.quality.ok || !run.result.complete)
  throw new Error('Default demo must pass quality gates and produce a complete portfolio.');
const tokens = renderTokens(data, run, health);
const template = await read('web/template.html');
const outputs = new Map();
for (const [path, asset] of [
  ['index.html', './docs/'],
  ['docs/index.html', './'],
]) {
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (key === 'ASSET') return asset;
    if (!(key in tokens)) throw new Error(`Unknown template token ${key}.`);
    return tokens[key];
  });
  outputs.set(path, html);
}
for (const name of ['app.mjs', 'worker.mjs', 'styles.css', 'favicon.svg'])
  outputs.set(`docs/assets/${name}`, await read(`web/${name}`));
for (const name of ['engine.mjs', 'demo.mjs', 'view.mjs', 'html.mjs'])
  outputs.set(`docs/assets/${name}`, await read(`src/${name}`));
outputs.set('.nojekyll', '');
outputs.set('docs/.nojekyll', '');
outputs.set('docs/data/catalogue.json', await read('research/catalogue.json'));
outputs.set('docs/data/source-health.json', await read('research/source-health.json'));
outputs.set('docs/data/legacy-audit.json', await read('research/legacy-audit.json'));
outputs.set('docs/data/legacy-audit.md', auditMarkdown(audit, data));
outputs.set('docs/data/next-session.md', handoffMarkdown(data));
for (const name of ['model-card.md', 'review-passes.md'])
  outputs.set(
    `docs/data/${name}`,
    (await read(`research/${name}`)).replaceAll('../docs/data/next-session.md', 'next-session.md'),
  );
outputs.set('docs/data/synthetic-projections.csv', projectionCsv(run));
outputs.set('docs/data/synthetic-lineups.csv', lineupCsv(run));
const sourceMap = new Map(data.sources.map((s) => [s.id, s]));
outputs.set(
  'docs/data/features.csv',
  toCsv([
    [
      'id',
      'capability',
      'scope',
      'public_claim',
      'evidence_kind',
      'access_status',
      'implementation',
      'independent_plan',
      'limitation',
      'evidence_refs',
      'access_evidence_refs',
      'required_inputs',
      'source_urls',
      'observed_on',
    ],
    ...data.features.map((f) => [
      f.id,
      f.title,
      f.scope,
      f.claim,
      f.kind,
      f.access,
      f.implementation,
      f.plan,
      f.caveat,
      f.evidence.join(';'),
      f.accessEvidence.join(';'),
      f.inputs.join(';'),
      [
        ...new Set(
          [...f.evidence, ...f.accessEvidence].map((ref) => sourceMap.get(ref.split(':')[0]).url),
        ),
      ].join(';'),
      data.reviewedOn,
    ]),
  ]),
);

const check = process.argv.includes('--check');
const different = [];
for (const [path, content] of outputs) {
  if (check) {
    const old = await read(path).catch(() => null);
    if (content !== old) different.push(path);
  } else {
    await mkdir(new URL('./', new URL(path, root)), { recursive: true });
    await writeFile(new URL(path, root), content);
  }
}
if (different.length) {
  console.error(
    `Generated files are stale. Run npm run build and include:\n${different.join('\n')}`,
  );
  process.exitCode = 1;
} else
  console.log(
    `${check ? 'Verified' : 'Generated'} ${outputs.size} deterministic site assets. Both main:/ and main:/docs entrypoints are supported.`,
  );
