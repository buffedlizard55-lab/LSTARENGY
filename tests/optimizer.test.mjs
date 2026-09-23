import test from 'node:test';
import assert from 'node:assert/strict';
import { optimize, frozenSlots, projectSlate, DEMO_RULES, effectiveStart } from '../src/engine.mjs';
import { makeFixture, runScenario } from '../src/demo.mjs';

const asOf = '2026-09-22T16:00:00Z';
const rules = {
  id: 'tiny',
  salaryCap: 15,
  minTeams: 2,
  maxPerTeam: 2,
  slots: [
    { id: 'QB', positions: ['QB'] },
    { id: 'WR', positions: ['WR'] },
    { id: 'FLEX', positions: ['WR', 'RB'] },
  ],
};
function player(id, position, team, salary, mean) {
  return {
    id,
    name: id,
    position,
    team,
    salary,
    mean,
    status: 'active',
    gameStartAt: '2026-09-22T18:00:00Z',
  };
}
const tiny = () => [
  player('qa', 'QB', 'A', 6, 20),
  player('qb', 'QB', 'B', 5, 17),
  player('wa', 'WR', 'A', 5, 16),
  player('wb', 'WR', 'B', 5, 15),
  player('rb', 'RB', 'C', 4, 12),
  player('wc', 'WR', 'C', 3, 8),
];

// Deliberately simple exhaustive oracle: no bounds or symmetry optimizations.
function oracle(players, config) {
  let best = -Infinity;
  function visit(ids) {
    if (ids.length < config.rules.slots.length) {
      const slot = config.rules.slots[ids.length];
      for (const p of players) {
        if (
          !ids.includes(p.id) &&
          slot.positions.includes(p.position) &&
          p.status === 'active' &&
          !config.exclude?.includes(p.id) &&
          (!config.locks?.[slot.id] || config.locks[slot.id] === p.id)
        )
          visit([...ids, p.id]);
      }
      return;
    }
    const lineup = ids.map((id) => players.find((p) => p.id === id));
    const teams = new Set(lineup.map((p) => p.team));
    if (
      lineup.reduce((s, p) => s + p.salary, 0) > config.rules.salaryCap ||
      teams.size < config.rules.minTeams ||
      [...teams].some(
        (team) => lineup.filter((p) => p.team === team).length > config.rules.maxPerTeam,
      )
    )
      return;
    if (
      config.qbStack &&
      !lineup.some(
        (q) =>
          q.position === 'QB' &&
          lineup.some((p) => ['WR', 'TE'].includes(p.position) && p.team === q.team),
      )
    )
      return;
    best = Math.max(
      best,
      lineup.reduce((s, p) => s + p.mean, 0),
    );
  }
  visit([]);
  return best;
}
function checkLineup(run) {
  const byId = new Map(run.players.map((p) => [p.id, p]));
  const keys = new Set();
  for (const line of run.result.lineups) {
    assert.equal(line.ids.length, DEMO_RULES.slots.length);
    assert.equal(new Set(line.ids).size, line.ids.length);
    assert.ok(line.salary <= DEMO_RULES.salaryCap);
    assert.ok(!keys.has([...line.ids].sort().join('|')));
    keys.add([...line.ids].sort().join('|'));
    line.ids.forEach((id, i) =>
      assert.ok(DEMO_RULES.slots[i].positions.includes(byId.get(id).position)),
    );
    assert.ok(Math.abs(line.points - line.ids.reduce((s, id) => s + byId.get(id).mean, 0)) < 1e-9);
    for (const [slot, id] of Object.entries(run.locks ?? {}))
      assert.equal(line.ids[DEMO_RULES.slots.findIndex((s) => s.id === slot)], id);
  }
}

test('hand-sized lineup matches brute force and does not mutate inputs', () => {
  const pool = tiny();
  const copy = structuredClone(pool);
  const result = optimize(pool, { asOf, rules });
  assert.ok(result.complete);
  assert.equal(result.lineups[0].points, oracle(pool, { rules }));
  assert.deepEqual(pool, copy);
});
test('bounded exact solver matches exhaustive oracle across 120 seeded pools', () => {
  let seed = 1945;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 120; i++) {
    const pool = tiny().map((p) => ({
      ...p,
      salary: 1 + Math.floor(random() * 9),
      mean: Math.floor(random() * 30) - 8,
    }));
    const config = {
      asOf,
      rules: { ...rules, salaryCap: 4 + Math.floor(random() * 20) },
      qbStack: i % 2 === 0,
    };
    const result = optimize(pool, config);
    const expected = oracle(pool, config);
    assert.equal(result.complete, Number.isFinite(expected), `pool ${i}`);
    if (result.complete)
      assert.ok(Math.abs(result.lineups[0].points - expected) < 1e-9, `pool ${i}`);
  }
});
test('ties are deterministic across input orders', () => {
  const pool = tiny().map((p) => ({ ...p, mean: 1, salary: 1 }));
  assert.deepEqual(
    optimize(pool, { asOf, rules }).lineups,
    optimize([...pool].reverse(), { asOf, rules }).lineups,
  );
});
test('negative optima are not replaced with an empty zero-score lineup', () => {
  const pool = tiny().map((p) => ({ ...p, mean: -Math.abs(p.mean) }));
  assert.equal(optimize(pool, { asOf, rules }).lineups[0].points, oracle(pool, { rules }));
});
test('locks and exclusions are enforced against independent oracle', () => {
  const config = { asOf, rules, locks: { QB: 'qb' }, exclude: ['wa'] };
  const result = optimize(tiny(), config);
  assert.equal(result.lineups[0].ids[0], 'qb');
  assert.ok(!result.lineups[0].ids.includes('wa'));
  assert.equal(result.lineups[0].points, oracle(tiny(), config));
});
test('lock conflicts, duplicates, unknown IDs and invalid options reject', () => {
  for (const config of [
    { locks: { QB: 'not-a-player' } },
    { locks: { BAD: 'qa' } },
    { locks: { QB: 'wa' } },
    { locks: { WR: 'wa', FLEX: 'wa' } },
    { locks: { QB: 'qa' }, exclude: ['qa'] },
    { exclude: ['unknown'] },
    { count: 0 },
    { count: 4 },
    { maxExposure: 1.1 },
    { minUnique: 0 },
    { maxNodes: 0 },
  ])
    assert.throws(() => optimize(tiny(), { asOf, rules, ...config }));
  assert.throws(() => optimize([...tiny(), tiny()[0]], { asOf, rules }), /Duplicate/);
  assert.throws(() => optimize(tiny(), { rules }), /Timestamp/);
});
test('infeasible salary, position and team constraints return no portfolio', () => {
  for (const r of [
    { ...rules, salaryCap: 1 },
    {
      ...rules,
      minTeams: 3,
      maxPerTeam: 1,
      slots: [
        { id: 'QB1', positions: ['QB'] },
        { id: 'QB2', positions: ['QB'] },
        { id: 'QB3', positions: ['QB'] },
      ],
    },
    { ...rules, minTeams: 3, maxPerTeam: 1, salaryCap: 3 },
  ]) {
    const result = optimize(tiny(), { asOf, rules: r });
    assert.equal(result.complete, false);
    assert.deepEqual(result.lineups, []);
  }
});
test('search-budget exhaustion never returns an unproven optimum', () => {
  assert.throws(() => optimize(tiny(), { asOf, rules, maxNodes: 1 }), { code: 'search-budget' });
});
test('exposures use requested portfolio denominator, never silently round up', () => {
  const result = optimize(tiny(), { asOf, rules, count: 3, maxExposure: 0.5 });
  assert.equal(result.complete, false);
  assert.deepEqual(result.lineups, []);
  assert.equal(optimize(tiny(), { asOf, rules, maxExposure: 0 }).complete, false);
});
test('minimum uniqueness is by player set, not interchangeable slot assignment', () => {
  const result = optimize(tiny(), { asOf, rules, count: 3, minUnique: 1 });
  assert.ok(result.complete);
  const keys = result.lineups.map((l) => [...l.ids].sort().join('|'));
  assert.equal(new Set(keys).size, 3);
});
test('all standard demo lineups satisfy explicit project rules', () => {
  for (const scenario of ['baseline', 'stack', 'late']) checkLineup(runScenario(scenario));
  const run = runScenario('stack');
  const byId = new Map(run.players.map((p) => [p.id, p]));
  for (const l of run.result.lineups) {
    const qb = byId.get(l.ids[0]);
    assert.ok(
      l.ids.some((id) => {
        const p = byId.get(id);
        return p.team === qb.team && ['WR', 'TE'].includes(p.position);
      }),
    );
  }
});
test('late swap freezes original slots and prevents newly locked additions', () => {
  const run = runScenario('late');
  assert.ok(Object.keys(run.locks).length > 0);
  const line = run.result.lineups[0];
  const original = new Set(run.previous.ids);
  line.ids.forEach((id, i) => {
    const p = run.players.find((p) => p.id === id);
    if (effectiveStart(p) <= Date.parse(run.asOf)) {
      assert.ok(original.has(id));
      assert.equal(run.previous.ids[i], id);
    }
    if (p.name === run.changedPlayer) assert.fail('Scratched player must not remain in new lineup');
  });
});
test('locked players remain at boundary time and after an early actual start', () => {
  const pool = tiny();
  const line = optimize(pool, { asOf, rules }).lineups[0].ids;
  const all = frozenSlots(line, pool, '2026-09-22T18:00:00Z', rules);
  assert.equal(Object.keys(all).length, 3);
  pool.forEach((p) => (p.actualStartAt = '2026-09-22T15:59:00Z'));
  assert.equal(Object.keys(frozenSlots(line, pool, asOf, rules)).length, 3);
  assert.equal(optimize(pool, { asOf, rules }).complete, false);
});
test('saved invalid lineups and ineligible slot reassignment are rejected', () => {
  assert.throws(() => frozenSlots(['qa'], tiny(), asOf, rules));
  assert.throws(() => frozenSlots(['qa', 'wa', 'wa'], tiny(), asOf, rules), /repeats/);
  assert.throws(() => frozenSlots(['wa', 'qa', 'wb'], tiny(), asOf, rules), /Invalid saved/);
});
test('a started, frozen player can remain even if later marked out', () => {
  const pool = tiny();
  const previous = optimize(pool, { asOf, rules }).lineups[0].ids;
  pool.forEach((p) => (p.status = 'out'));
  const time = '2026-09-22T18:00:00Z';
  const locks = frozenSlots(previous, pool, time, rules);
  const result = optimize(pool, { asOf: time, rules, locks });
  assert.ok(result.complete);
  assert.deepEqual(result.lineups[0].ids, previous);
});

test('an unstarted out player cannot be forced in by a manual lock', () => {
  const pool = tiny();
  pool[0].status = 'out';
  const result = optimize(pool, { asOf, rules, locks: { QB: 'qa' } });
  assert.equal(result.complete, false);
  assert.deepEqual(result.lineups, []);
});

test('exposure just below 100 percent for one lineup is not rounded up', () => {
  const result = optimize(tiny(), { asOf, rules, maxExposure: 0.99999999999999 });
  assert.equal(result.complete, false);
});

test('objective-bound overflow fails closed', () => {
  const pool = tiny().map((p) => ({ ...p, mean: Number.MAX_VALUE }));
  assert.throws(() => optimize(pool, { asOf, rules }), /Computed objective bound/);
});

test('a greedy portfolio failure is not mislabeled as a global infeasibility proof', () => {
  const result = optimize(tiny(), { asOf, rules, count: 3, maxExposure: 0.5 });
  assert.match(result.reason, /not a global infeasibility proof/);
});

test('close but unequal objective values are not rounded into ties', () => {
  const pool = [player('a', 'WR', 'A', 1, 1), player('z', 'WR', 'A', 1, 1 + 1e-11)];
  const simple = {
    id: 'single',
    salaryCap: 2,
    minTeams: 1,
    maxPerTeam: 1,
    slots: [{ id: 'WR', positions: ['WR'] }],
  };
  assert.equal(optimize(pool, { asOf, rules: simple }).lineups[0].ids[0], 'z');
});

test('prototype-like slot keys do not create inherited locks', () => {
  const r = {
    ...rules,
    slots: rules.slots.map((s, i) => ({ ...s, id: i === 0 ? 'constructor' : s.id })),
  };
  assert.ok(optimize(tiny(), { asOf, rules: r }).complete);
  const existing = optimize(tiny(), { asOf, rules: r }).lineups[0].ids;
  const locks = frozenSlots(existing, tiny(), '2026-09-22T18:00:00Z', r);
  assert.equal(Object.keys(locks).length, 3);
});

test('mixed-sign prefix overflow fails even if a suffix upper bound is finite', () => {
  const pool = [
    player('a', 'QB', 'A', 1, Number.MAX_VALUE),
    player('b', 'WR', 'B', 1, Number.MAX_VALUE),
    player('c', 'RB', 'C', 1, -Number.MAX_VALUE),
  ];
  const r = {
    ...rules,
    slots: [
      { id: 'QB', positions: ['QB'] },
      { id: 'WR', positions: ['WR'] },
      { id: 'RB', positions: ['RB'] },
    ],
  };
  assert.throws(() => optimize(pool, { asOf, rules: r }), /Computed partial objective/);
});
