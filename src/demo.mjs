import {
  DEMO_RULES,
  MODEL_VERSION,
  qualityReport,
  projectSlate,
  optimize,
  frozenSlots,
  walkForward,
  expectedValue,
  toCsv,
} from './engine.mjs';

/** All entities, dates, salaries and scores below are authored test fixtures. */
export function makeFixture() {
  const teams = ['Atlas', 'Orbit', 'Harbor', 'Summit'];
  const roles = [
    ['qb', 'QB', 'Quarterback', 21, 7200],
    ['rb', 'RB', 'Running back', 17, 6600],
    ['wr-a', 'WR', 'Receiver A', 18, 6300],
    ['wr-b', 'WR', 'Receiver B', 12, 4500],
    ['te', 'TE', 'Tight end', 11, 4000],
    ['dst', 'DST', 'Defense', 7, 3000],
  ];
  const players = teams.flatMap((team, t) =>
    roles.map(([code, position, name, base, salary], r) => ({
      id: `${team.toLowerCase()}-${code}`,
      name: `${team} ${name}`,
      team: team.toUpperCase(),
      gameId: t < 2 ? 'fixture-early' : 'fixture-late',
      position,
      salary: salary + [200, -200, 0, 100][t],
      status: 'active',
      gameStartAt: t < 2 ? '2026-09-22T18:00:00Z' : '2026-09-22T21:00:00Z',
      history: Array.from({ length: 10 }, (_, week) => {
        const start = new Date(Date.UTC(2026, 6, 14 + week * 7, 17));
        return {
          eventId: `fixture-${week + 1}`,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 3 * 3600000).toISOString(),
          availableAt: new Date(start.getTime() + 4 * 3600000).toISOString(),
          points:
            Math.round(
              (base +
                [1, -1.5, 0.5, 0][t] +
                Math.sin((week + 1) * (r + 2) + t) * 4 +
                (((week + t) % 3) - 1) * 1.3) *
                100,
            ) / 100,
        };
      }),
    })),
  );
  return {
    schemaVersion: 1,
    dataKind: 'synthetic',
    source: 'project-authored-fixture',
    asOf: '2026-09-22T16:00:00Z',
    fetchedAt: '2026-09-22T15:55:00Z',
    players,
  };
}

export const SCENARIOS = [
  {
    id: 'baseline',
    title: 'Baseline',
    detail: 'Three distinct lineups; maximize summed fixture means under project roster rules.',
  },
  {
    id: 'stack',
    title: 'QB + receiver stack',
    detail:
      'Require one same-team QB + WR/TE pair in each of three lineups. No fitted correlation benefit is assumed.',
  },
  {
    id: 'late',
    title: 'Late scratch & swap',
    detail:
      'At simulated 18:30 UTC, preserve all started-game players in their exact slots, then replace an unstarted scratched player.',
  },
  {
    id: 'stale',
    title: 'Stale feed test',
    detail:
      'A 48-hour-old fixture snapshot fails the project’s 24-hour freshness gate. No lineup or CSV is published.',
  },
];

export function runScenario(id = 'baseline') {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error(`Unknown demo scenario: ${id}`);
  const slate = makeFixture();
  let locks = {};
  let changedPlayer = null;
  let previous = null;
  if (id === 'stale') slate.fetchedAt = '2026-09-20T16:00:00Z';
  if (id === 'late') {
    const initial = projectSlate(slate);
    previous = optimize(initial, { asOf: slate.asOf }).lineups[0];
    slate.asOf = '2026-09-22T18:30:00Z';
    slate.fetchedAt = '2026-09-22T18:30:00Z';
    locks = frozenSlots(previous.ids, initial, slate.asOf);
    const candidate = previous.ids
      .map((playerId) => slate.players.find((p) => p.id === playerId))
      .find((p) => p.gameId === 'fixture-late' && p.position === 'WR');
    if (!candidate) throw new Error('Late-swap fixture must have an unstarted receiver.');
    candidate.status = 'out';
    changedPlayer = candidate.name;
  }
  const quality = qualityReport(slate);
  if (!quality.ok)
    return {
      scenario,
      quality,
      dataKind: 'synthetic',
      asOf: slate.asOf,
      players: [],
      result: null,
      modelVersion: MODEL_VERSION,
    };
  const players = projectSlate(slate);
  const result = optimize(players, {
    asOf: slate.asOf,
    count: id === 'late' ? 1 : 3,
    qbStack: id === 'stack',
    locks,
  });
  return {
    scenario,
    quality,
    dataKind: 'synthetic',
    asOf: slate.asOf,
    modelVersion: MODEL_VERSION,
    players,
    result,
    locks,
    changedPlayer,
    previous,
    evaluation: { ...walkForward(slate.players), dataKind: 'synthetic' },
    ev: {
      assumedWinProbability: 0.55,
      assumedPushProbability: 0,
      decimalOdds: 1.91,
      perUnit: expectedValue(1.91, 0.55, 0),
    },
  };
}

export function projectionCsv(run) {
  if (!run.quality.ok || !run.result?.complete)
    throw new Error('Quality-gated output cannot be exported.');
  return toCsv([
    [
      'data_kind',
      'as_of',
      'model_version',
      'player_id',
      'name',
      'position',
      'salary',
      'status',
      'mean_points',
      'historical_p10',
      'historical_p90',
      'sample_size',
    ],
    ...run.players.map((p) => [
      'synthetic',
      run.asOf,
      run.modelVersion,
      p.id,
      p.name,
      p.position,
      p.salary,
      p.status,
      p.mean.toFixed(4),
      p.p10.toFixed(4),
      p.p90.toFixed(4),
      p.sampleSize,
    ]),
  ]);
}
export function lineupCsv(run) {
  if (!run.quality.ok || !run.result?.complete)
    throw new Error('Quality-gated output cannot be exported.');
  return toCsv([
    [
      'data_kind',
      'as_of',
      'model_version',
      'research_rules',
      'scenario',
      'lineup_number',
      'salary',
      'mean_points',
      ...DEMO_RULES.slots.map((s) => s.id),
    ],
    ...run.result.lineups.map((l, index) => [
      'synthetic',
      run.asOf,
      run.modelVersion,
      DEMO_RULES.id,
      run.scenario.id,
      index + 1,
      l.salary,
      l.points.toFixed(4),
      ...l.ids,
    ]),
  ]);
}
