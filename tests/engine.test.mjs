import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timestamp,
  forecast,
  quantile,
  qualityReport,
  projectSlate,
  walkForward,
  expectedValue,
  americanToDecimal,
  noVigTwoWay,
  csvCell,
  toCsv,
} from '../src/engine.mjs';
import { makeFixture, runScenario, projectionCsv, lineupCsv } from '../src/demo.mjs';

const history = () => makeFixture().players[0].history;

test('timestamps require real calendar dates and an explicit timezone', () => {
  assert.equal(timestamp('2026-09-22T18:00:00Z'), timestamp('2026-09-22T14:00:00-04:00'));
  for (const invalid of [
    '2026-09-22',
    '2026-09-22T18:00:00',
    '2026-02-30T18:00:00Z',
    '2026-09-22T25:00:00Z',
    '',
    null,
    1,
  ])
    assert.throws(() => timestamp(invalid));
});
test('weighted mean has a hand-calculated oracle', () => {
  const rows = history()
    .slice(0, 3)
    .map((r, i) => ({ ...r, points: (i + 1) * 10 }));
  const f = forecast(rows, '2026-09-22T16:00:00Z', { decay: 0.5 });
  assert.ok(Math.abs(f.mean - (2.5 + 10 + 30) / 1.75) < 1e-12);
  assert.equal(f.sampleSize, 3);
  assert.equal(f.p10, 12);
  assert.equal(f.p90, 28);
});
test('only latest six known observations; does not mutate history', () => {
  const rows = history().reverse();
  const before = structuredClone(rows);
  const f = forecast(rows, '2026-09-22T16:00:00Z');
  assert.deepEqual(rows, before);
  assert.equal(f.sampleSize, 6);
  assert.deepEqual(f.usedEventIds, [
    'fixture-5',
    'fixture-6',
    'fixture-7',
    'fixture-8',
    'fixture-9',
    'fixture-10',
  ]);
});
test('future publication cannot leak into a forecast', () => {
  const rows = history();
  rows[9].availableAt = '2026-09-23T00:00:00Z';
  rows[9].points = 999999;
  const f = forecast(rows, '2026-09-22T16:00:00Z');
  assert.ok(!f.usedEventIds.includes('fixture-10'));
  assert.ok(f.mean < 100);
});
test('an event in progress cannot leak, even at the end-time boundary', () => {
  const rows = history();
  const target = rows[9];
  const f = forecast(rows, target.startAt);
  assert.ok(!f.usedEventIds.includes(target.eventId));
  assert.ok(!forecast(rows, target.endAt).usedEventIds.includes(target.eventId));
});
test('minimum sample count is enforced; missing data is never zero', () => {
  assert.throws(() => forecast(history().slice(0, 2), '2026-09-22T16:00:00Z'), {
    code: 'insufficient-history',
  });
  assert.throws(() => forecast([], '2026-09-22T16:00:00Z'), { code: 'insufficient-history' });
});
test('duplicate events, invalid times, and nonfinite/absent points are rejected', () => {
  assert.throws(() => forecast([...history(), history()[0]], '2026-09-22T16:00:00Z'), /Duplicate/);
  for (const invalid of [NaN, Infinity, null, undefined, '12', false]) {
    const rows = history();
    rows[0].points = invalid;
    assert.throws(() => forecast(rows, '2026-09-22T16:00:00Z'));
  }
  const rows = history();
  rows[0].availableAt = rows[0].startAt;
  assert.throws(() => forecast(rows, '2026-09-22T16:00:00Z'), /timestamps/);
});
test('forecast option boundaries are enforced', () => {
  for (const options of [
    { window: 0 },
    { window: 2 },
    { window: 4.5 },
    { decay: 0 },
    { decay: 1.1 },
    { decay: NaN },
    { minSamples: 0 },
  ])
    assert.throws(() => forecast(history(), '2026-09-22T16:00:00Z', options));
  assert.doesNotThrow(() => forecast(history(), '2026-09-22T16:00:00Z', { decay: 1 }));
});
test('negative scores and quantile endpoints are supported', () => {
  assert.equal(quantile([-5, 0, 5], 0), -5);
  assert.equal(quantile([-5, 0, 5], 1), 5);
  assert.equal(quantile([-5, 0, 5], 0.5), 0);
  assert.throws(() => quantile([], 0.5));
  assert.throws(() => quantile([1, 2], -0.1));
});
test('fixture passes quality and preserves synthetic identity', () => {
  const fixture = makeFixture();
  assert.deepEqual(qualityReport(fixture), { ok: true, errors: [] });
  assert.equal(projectSlate(fixture).length, 24);
});
test('stale, future and non-synthetic snapshots fail closed', () => {
  for (const mutation of [
    (s) => (s.fetchedAt = '2026-09-20T00:00:00Z'),
    (s) => (s.fetchedAt = '2026-09-23T00:00:00Z'),
    (s) => (s.dataKind = 'live'),
    (s) => (s.source = 'vendor-output'),
  ]) {
    const slate = makeFixture();
    mutation(slate);
    assert.equal(qualityReport(slate).ok, false);
    assert.throws(() => projectSlate(slate), { code: 'quality-gate' });
  }
});
test('unknown status, conflicting game times, duplicate IDs and bad salary fail quality', () => {
  for (const mutation of [
    (s) => (s.players[0].status = 'unknown'),
    (s) => (s.players[0].gameStartAt = '2026-09-22T19:00:00Z'),
    (s) => (s.players[0].id = s.players[1].id),
    (s) => (s.players[0].salary = 0),
    (s) => (s.players[0].salary = 1500.5),
    (s) => (s.players[0].position = 'UNKNOWN'),
  ]) {
    const slate = makeFixture();
    mutation(slate);
    assert.equal(qualityReport(slate).ok, false);
  }
});
test('an explicitly out player has a displayed zero, not an imputed missing value', () => {
  const slate = makeFixture();
  slate.players[0].status = 'out';
  const p = projectSlate(slate)[0];
  assert.equal(p.mean, 0);
  assert.equal(p.value, 0);
  assert.equal(p.sampleSize, 6);
});
test('walk-forward forecasts exclude every held-out target and are deterministic', () => {
  const slate = makeFixture();
  const report = walkForward(slate.players);
  assert.equal(report.n, 24 * 7);
  assert.deepEqual(report, walkForward(slate.players));
  for (const p of report.predictions) assert.ok(!p.trainingIds.includes(p.eventId));
  assert.ok(report.rmse >= report.mae);
  assert.ok(Math.abs(report.mae - 2.870740745059444) < 1e-12);
  assert.throws(() => walkForward([]), /No eligible/);
});
test('EV distinguishes a push from a loss and matches hand-calculated payouts', () => {
  assert.ok(Math.abs(expectedValue(1.91, 0.55) - 0.0505) < 1e-12);
  assert.equal(expectedValue(2, 0.5), 0);
  assert.ok(Math.abs(expectedValue(2, 0.4, 0.2)) < 1e-12);
  assert.equal(expectedValue(2, 0, 1), 0);
  assert.equal(expectedValue(2, 0), -1);
  for (const args of [
    [1, 0.5],
    [2, -0.1],
    [2, 0.8, 0.3],
    [NaN, 0.5],
    [2, null],
    [2, 0.5, -0.1],
  ])
    assert.throws(() => expectedValue(...args));
});
test('American odds and two-way no-vig math do not claim true probabilities', () => {
  assert.equal(americanToDecimal(150), 2.5);
  assert.equal(americanToDecimal(-200), 1.5);
  assert.deepEqual(noVigTwoWay(1.9, 1.9), [0.5, 0.5]);
  assert.ok(Math.abs(noVigTwoWay(2, 4).reduce((a, b) => a + b) - 1) < 1e-12);
  for (const bad of [0, 50, -50, NaN, null]) assert.throws(() => americanToDecimal(bad));
  assert.throws(() => noVigTwoWay(1, 2));
});
test('CSV protects formulas, quotes and newlines', () => {
  assert.equal(csvCell('hello,"friend"'), '"hello,""friend"""');
  for (const value of ['=1+1', '+1', '-cmd', '@sum(A1)', '\t=1', '\n=2', '   =1'])
    assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(
    toCsv([
      ['a', 'b'],
      ['x\ny', null],
    ]),
    '"a","b"\r\n"x\ny",""\r\n',
  );
});
test('all automatic scenarios are deterministic and stale output cannot export', () => {
  for (const id of ['baseline', 'stack', 'late']) {
    const run = runScenario(id);
    assert.ok(run.quality.ok && run.result.complete);
    assert.deepEqual(run, runScenario(id));
    assert.match(projectionCsv(run), /synthetic/);
    assert.match(lineupCsv(run), /research-nfl-shaped-v1/);
  }
  const blocked = runScenario('stale');
  assert.equal(blocked.result, null);
  assert.equal(blocked.players.length, 0);
  assert.throws(() => projectionCsv(blocked));
  assert.throws(() => lineupCsv(blocked));
  assert.throws(() => runScenario('unknown'));
});

test('arithmetic overflow is rejected instead of exporting Infinity or NaN', () => {
  const rows = history().map((r) => ({ ...r, points: Number.MAX_VALUE }));
  assert.throws(() => forecast(rows, '2026-09-22T16:00:00Z'), /Computed forecast/);
  assert.throws(
    () => quantile([-Number.MAX_VALUE, Number.MAX_VALUE], 0.5),
    /Computed historical quantile/,
  );
  const large = [
    {
      ...makeFixture().players[0],
      history: history().map((r, i) => ({ ...r, points: i % 2 ? 1e200 : -1e200 })),
    },
  ];
  assert.throws(() => walkForward(large), /Computed RMSE/);
});

test('walk-forward mathematics does not fabricate a data-provenance label', () => {
  const generic = walkForward(makeFixture().players);
  assert.equal(generic.dataKind, undefined);
  assert.equal(runScenario().evaluation.dataKind, 'synthetic');
});

test('derived value ratios and freshness thresholds cannot overflow silently', () => {
  const fixture = makeFixture();
  fixture.players.forEach((p) => {
    p.salary = 1;
    p.history.forEach((h) => {
      h.points = 1e306;
    });
  });
  assert.throws(() => projectSlate(fixture), /Computed value ratio/);
  assert.equal(qualityReport(makeFixture(), { maxAgeHours: Number.MAX_VALUE }).ok, false);
});

test('odds conversion rejects lost decimal precision and all-push arithmetic stays exact', () => {
  assert.throws(() => americanToDecimal(-Number.MAX_VALUE), /Converted decimal odds/);
  assert.equal(expectedValue(2, 0, 1), 0);
  assert.equal(expectedValue(2, 0.9, 0.1), 0.9);
});
