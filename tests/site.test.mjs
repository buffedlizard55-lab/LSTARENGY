import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
for (const name of ['index.html', 'docs/index.html']) {
  test(`${name}: all evidence anchors exist and IDs are unique`, async () => {
    const html = await readFile(new URL(name, root), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g))
      assert.ok(ids.includes(id), `Missing anchor ${id}`);
    assert.ok(!html.includes('{{'));
    assert.match(html, /Synthetic data only/);
    assert.match(html, /No accuracy-parity claim/);
  });
  test(`${name}: local assets/downloads exist and all URLs are relative or HTTPS`, async () => {
    const html = await readFile(new URL(name, root), 'utf8');
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (href.startsWith('#') || href.startsWith('https://')) continue;
      assert.ok(!href.startsWith('/') && !href.startsWith('http:'), `Nonportable path ${href}`);
      await access(new URL(href, new URL(name, root)));
    }
    assert.ok(!/<script[^>]*>(?!\s*<\/script>)/i.test(html), 'No inline scripts');
    assert.ok(!/\son\w+=/i.test(html), 'No inline event handlers');
  });
}
test('both entrypoints render the same body apart from asset base paths', async () => {
  const [main, docs] = await Promise.all(
    ['index.html', 'docs/index.html'].map((name) => readFile(new URL(name, root), 'utf8')),
  );
  assert.equal(main.replaceAll('./docs/', './'), docs);
});
test('published data files retain explicit prototype and no-live-feed boundaries', async () => {
  const data = JSON.parse(await readFile(new URL('docs/data/catalogue.json', root), 'utf8'));
  assert.ok(
    data.features.every((f) => ['Prototype', 'Planned', 'Blocked'].includes(f.implementation)),
  );
  assert.ok(data.sports.every((s) => s.status === 'Not integrated'));
  const csv = await readFile(new URL('docs/data/synthetic-projections.csv', root), 'utf8');
  assert.equal(csv.trim().split('\r\n').length, 25);
  assert.match(csv, /"data_kind"/);
});

test('canonical and published Markdown links resolve to existing local files', async () => {
  for (const name of [
    'README.md',
    'research/model-card.md',
    'research/review-passes.md',
    'docs/data/model-card.md',
    'docs/data/review-passes.md',
    'docs/data/next-session.md',
    'docs/data/legacy-audit.md',
  ]) {
    const text = await readFile(new URL(name, root), 'utf8');
    for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (href.startsWith('https://') || href.startsWith('#')) continue;
      await access(new URL(href, new URL(name, root)));
    }
  }
});

test('availability report is separate from review dates and includes policy skips', async () => {
  const data = JSON.parse(await readFile(new URL('docs/data/catalogue.json', root), 'utf8'));
  const report = JSON.parse(await readFile(new URL('docs/data/source-health.json', root), 'utf8'));
  assert.equal(report.results.length, data.sources.length);
  assert.equal(new Set(report.results.map((r) => r.sourceId)).size, report.results.length);
  for (const result of report.results) {
    const source = data.sources.find((s) => s.id === result.sourceId);
    assert.ok(source);
    assert.equal(result.reviewedOn, source.observedOn);
    if (!source.monitor) assert.equal(result.status, 'skipped-policy');
    assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
    assert.notEqual(result.status, 'verified');
  }
});
