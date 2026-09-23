import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalogue, digest, escapeHtml } from '../src/catalogue.mjs';
import { renderTokens } from '../src/render.mjs';
import { runScenario } from '../src/demo.mjs';

const data = JSON.parse(
  await readFile(new URL('../research/catalogue.json', import.meta.url), 'utf8'),
);
const audit = JSON.parse(
  await readFile(new URL('../research/legacy-audit.json', import.meta.url), 'utf8'),
);
const check = (d = data, a = audit, t = '2026-09-22') => validateCatalogue(d, a, t);

test('every supported claim resolves to a dated, hashed primary/maintainer excerpt', () => {
  assert.deepEqual(check(), { errors: [], warnings: [] });
  assert.equal(data.features.length, 36);
  assert.equal(data.sources.length, 30);
  assert.equal(data.sports.length, 13);
});
test('unsupported claims cannot be labeled vendor-described without evidence', () => {
  const clone = structuredClone(data);
  clone.features[0].evidence = [];
  assert.ok(check(clone).errors.some((e) => e.includes('lacks evidence')));
});
test('paid and free access assertions require their own evidence', () => {
  const clone = structuredClone(data);
  clone.features[0].accessEvidence = [];
  assert.ok(check(clone).errors.some((e) => e.includes('access: claim lacks evidence')));
});
test('unknowns are explicit, not invented source citations', () => {
  const unknown = data.features.find((f) => f.kind === 'Unverified');
  assert.ok(unknown);
  assert.deepEqual(unknown.evidence, []);
  const clone = structuredClone(data);
  clone.features[0].evidence = ['S99:fake'];
  assert.ok(check(clone).errors.some((e) => e.includes('unknown evidence')));
});
test('excerpt edits invalidate stored integrity hashes', () => {
  const clone = structuredClone(data);
  clone.sources[0].excerpts[0].text += ' invented';
  assert.ok(check(clone).errors.some((e) => e.includes('hash mismatch')));
});
test('long excerpts are rejected even when rehashed', () => {
  const clone = structuredClone(data);
  const quote = clone.sources[0].excerpts[0];
  quote.text = 'word '.repeat(205);
  quote.sha256 = digest(quote.text);
  assert.ok(check(clone).errors.some((e) => e.includes('keep excerpts short')));
});
test('duplicate source/feature IDs and non-HTTPS sources are rejected', () => {
  const clone = structuredClone(data);
  clone.sources[1].id = clone.sources[0].id;
  clone.features[1].id = clone.features[0].id;
  clone.sources[0].url = 'http://example.com/';
  const errors = check(clone).errors.join('\n');
  assert.match(errors, /source ID/);
  assert.match(errors, /duplicate\/empty ID/);
  assert.match(errors, /HTTPS/);
});
test('future and invalid observation dates fail; stale snapshot dates only warn', () => {
  const clone = structuredClone(data);
  clone.sources[0].observedOn = '2026-09-23';
  assert.ok(check(clone).errors.length > 0);
  clone.sources[0].observedOn = '2026-02-30';
  assert.ok(check(clone).errors.length > 0);
  assert.ok(check(data, audit, '2026-11-01').warnings.length > 0);
  assert.equal(data.reviewedOn, '2026-09-22');
});
test('LineStar automated monitoring remains off', () => {
  for (const s of data.sources.filter((s) => new URL(s.url).hostname.includes('linestar')))
    assert.equal(s.monitor, false);
  const clone = structuredClone(data);
  clone.sources[0].monitor = true;
  assert.ok(check(clone).errors.some((e) => e.includes('monitoring must remain disabled')));
});
test('legacy review cites an immutable commit and valid original line ranges', () => {
  assert.equal(audit.entries.length, 62);
  const clone = structuredClone(audit);
  clone.baseCommit = 'main';
  clone.entries[0].start = -1;
  assert.ok(check(data, clone).errors.some((e) => e.includes('immutable base')));
  assert.ok(check(data, clone).errors.some((e) => e.includes('line range')));
});
test('rendering escapes text and does not execute HTML from research fields', () => {
  assert.equal(
    escapeHtml('<script>"&\'</script>'),
    '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;',
  );
  const clone = structuredClone(data);
  clone.features[0].title = '<img src=x onerror=alert(1)>';
  const result = renderTokens(clone, runScenario()).FEATURES;
  assert.ok(result.includes('&lt;img'));
  assert.ok(!result.includes('<img src=x'));
});

test('all 62 original line ranges match the actual immutable Git object', async () => {
  const { execFileSync } = await import('node:child_process');
  assert.equal(audit.baseCommit, '0ac0b07a4c19105b6b952b3ef7943fd2a02bc56b');
  const originals = new Map();
  for (const entry of audit.entries) {
    if (!originals.has(entry.file))
      originals.set(
        entry.file,
        execFileSync('git', ['show', `${audit.baseCommit}:${entry.file}`], {
          encoding: 'utf8',
        }).split(/\r?\n/),
      );
    const lines = originals.get(entry.file);
    assert.ok(entry.end <= lines.length);
    const text = lines.slice(entry.start - 1, entry.end).join('\n');
    assert.ok(text.trim());
    assert.equal(
      digest(text),
      entry.originalLineSha256,
      `${entry.file}:${entry.start}-${entry.end}`,
    );
  }
});
