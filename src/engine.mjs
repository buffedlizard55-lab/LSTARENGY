/** Independent research utilities. No LineStar data, coefficients, or implementation. */
export const MODEL_VERSION = 'synthetic-recency-mean-v1';
export const DEMO_RULES = Object.freeze({
  id: 'research-nfl-shaped-v1',
  description: 'Project-defined 9-slot research roster; not an operator entry format.',
  salaryCap: 50000,
  minTeams: 2,
  maxPerTeam: 5,
  slots: [
    { id: 'QB', positions: ['QB'] },
    { id: 'RB1', positions: ['RB'] },
    { id: 'RB2', positions: ['RB'] },
    { id: 'WR1', positions: ['WR'] },
    { id: 'WR2', positions: ['WR'] },
    { id: 'WR3', positions: ['WR'] },
    { id: 'TE', positions: ['TE'] },
    { id: 'FLEX', positions: ['RB', 'WR', 'TE'] },
    { id: 'DST', positions: ['DST'] },
  ],
});

export class InputError extends Error {
  constructor(message, code = 'invalid-input') {
    super(message);
    this.name = 'InputError';
    this.code = code;
  }
}
function requireThat(condition, message, code) {
  if (!condition) throw new InputError(message, code);
}
function number(value, name, min = -Infinity, max = Infinity) {
  requireThat(
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    `${name} must be a finite number in [${min}, ${max}].`,
  );
  return value;
}
function integer(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  number(value, name, min, max);
  requireThat(Number.isSafeInteger(value), `${name} must be an integer.`);
  return value;
}
function nonempty(value, name) {
  requireThat(typeof value === 'string' && value.trim().length > 0, `${name} is required.`);
}
export function timestamp(value, name = 'Timestamp') {
  requireThat(
    typeof value === 'string',
    `${name} must be an ISO timestamp with an explicit timezone.`,
  );
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireThat(
    parts && Number(parts[2]) < 24 && Number(parts[3]) < 60 && Number(parts[4]) < 60,
    `${name} must be a valid ISO timestamp with an explicit timezone.`,
  );
  const midnight = Date.parse(`${parts[1]}T00:00:00Z`);
  requireThat(
    Number.isFinite(midnight) && new Date(midnight).toISOString().slice(0, 10) === parts[1],
    `${name} contains an invalid calendar date.`,
  );
  const time = Date.parse(value);
  requireThat(Number.isFinite(time), `${name} is invalid.`);
  return time;
}
export function quantile(values, probability) {
  number(probability, 'Quantile probability', 0, 1);
  requireThat(Array.isArray(values) && values.length > 0, 'Quantile needs observations.');
  const sorted = values.map((v) => number(v, 'Observation')).sort((a, b) => a - b);
  const offset = (sorted.length - 1) * probability;
  const lo = Math.floor(offset);
  const value = sorted[lo] + (sorted[Math.ceil(offset)] - sorted[lo]) * (offset - lo);
  return number(value, 'Computed historical quantile');
}
function validateHistory(history) {
  requireThat(Array.isArray(history), 'History must be an array.');
  const ids = new Set();
  for (const row of history) {
    requireThat(row && typeof row === 'object', 'Invalid history row.');
    nonempty(row.eventId, 'History event ID');
    requireThat(!ids.has(row.eventId), `Duplicate historical event ${row.eventId}.`);
    ids.add(row.eventId);
    const start = timestamp(row.startAt, 'Historical start');
    const end = timestamp(row.endAt, 'Historical end');
    const available = timestamp(row.availableAt, 'Historical availability');
    requireThat(
      start < end && end <= available,
      'History timestamps must satisfy start < end <= availableAt.',
    );
    number(row.points, 'Historical points');
  }
}

/** Both completion AND publication must precede a decision; missing values are not zero. */
export function forecast(history, asOf, { window = 6, decay = 0.8, minSamples = 3 } = {}) {
  const cutoff = timestamp(asOf, 'Forecast cutoff');
  integer(window, 'Window', 1, 1000);
  integer(minSamples, 'Minimum samples', 1, window);
  number(decay, 'Decay', Number.EPSILON, 1);
  validateHistory(history);
  const known = history
    .filter((r) => timestamp(r.endAt) < cutoff && timestamp(r.availableAt) <= cutoff)
    .sort((a, b) => timestamp(a.endAt) - timestamp(b.endAt) || a.eventId.localeCompare(b.eventId))
    .slice(-window);
  requireThat(
    known.length >= minSamples,
    `Only ${known.length} known observations; need ${minSamples}.`,
    'insufficient-history',
  );
  let weighted = 0;
  let weightSum = 0;
  known.forEach((row, index) => {
    const weight = decay ** (known.length - 1 - index);
    weighted += row.points * weight;
    weightSum += weight;
  });
  return {
    mean: number(weighted / weightSum, 'Computed forecast'),
    p10: quantile(
      known.map((r) => r.points),
      0.1,
    ),
    p90: quantile(
      known.map((r) => r.points),
      0.9,
    ),
    sampleSize: known.length,
    lastAvailableAt: known.reduce(
      (latest, r) => (timestamp(r.availableAt) > timestamp(latest) ? r.availableAt : latest),
      known[0].availableAt,
    ),
    // These are historical quantiles, NOT calibrated prediction intervals.
    usedEventIds: known.map((r) => r.eventId),
    modelVersion: MODEL_VERSION,
  };
}

export function qualityReport(slate, { maxAgeHours = 24 } = {}) {
  const errors = [];
  function check(run) {
    try {
      run();
    } catch (error) {
      errors.push(error.message);
    }
  }
  check(() => {
    number(maxAgeHours, 'Freshness threshold (hours)', 0);
    requireThat(slate && typeof slate === 'object', 'Slate is required.');
    requireThat(slate.schemaVersion === 1, 'Unsupported slate schema.');
    requireThat(
      slate.dataKind === 'synthetic',
      'This demo only accepts explicitly synthetic data.',
    );
    requireThat(slate.source === 'project-authored-fixture', 'Unapproved demo data source.');
    const cutoff = timestamp(slate.asOf, 'Slate as-of');
    const fetched = timestamp(slate.fetchedAt, 'Snapshot timestamp');
    requireThat(fetched <= cutoff, 'Snapshot is from the future.');
    requireThat(
      cutoff - fetched <= number(maxAgeHours * 3600000, 'Computed freshness threshold'),
      `Stale snapshot: older than ${maxAgeHours} hours.`,
      'stale-data',
    );
    requireThat(
      Array.isArray(slate.players) && slate.players.length > 0 && slate.players.length <= 32,
      'Demo requires 1–32 players.',
    );
  });
  if (errors.length) return { ok: false, errors };
  const ids = new Set();
  const games = new Map();
  for (const player of slate.players) {
    check(() => {
      requireThat(player && typeof player === 'object', 'Invalid player record.');
      nonempty(player.id, 'Player ID');
      requireThat(!ids.has(player.id), `Duplicate player ID ${player.id}.`);
      ids.add(player.id);
      nonempty(player.name, 'Player name');
      nonempty(player.team, 'Team ID');
      nonempty(player.gameId, 'Game ID');
      requireThat(
        ['QB', 'RB', 'WR', 'TE', 'DST'].includes(player.position),
        `Invalid position for ${player.id}.`,
      );
      integer(player.salary, 'Salary', 1, 1000000);
      requireThat(
        ['active', 'out'].includes(player.status),
        `Unknown participation status for ${player.id}.`,
      );
      timestamp(player.gameStartAt, 'Game start');
      if (player.actualStartAt != null) timestamp(player.actualStartAt, 'Actual game start');
      const times = `${player.gameStartAt}|${player.actualStartAt ?? ''}`;
      requireThat(
        !games.has(player.gameId) || games.get(player.gameId) === times,
        `Conflicting game times for ${player.gameId}.`,
      );
      games.set(player.gameId, times);
      forecast(player.history, slate.asOf);
    });
  }
  return { ok: errors.length === 0, errors };
}

export function projectSlate(slate) {
  const quality = qualityReport(slate);
  requireThat(quality.ok, quality.errors.join(' '), 'quality-gate');
  return slate.players.map((p) => {
    const estimate = forecast(p.history, slate.asOf);
    const mean = p.status === 'out' ? 0 : estimate.mean;
    return {
      ...p,
      ...estimate,
      mean,
      value: number((mean / p.salary) * 1000, 'Computed value ratio'),
    };
  });
}

export function effectiveStart(player) {
  const scheduled = timestamp(player.gameStartAt);
  return player.actualStartAt == null
    ? scheduled
    : Math.min(scheduled, timestamp(player.actualStartAt));
}

/** Locks preserve the original SLOT, not merely membership in the player set. */
export function frozenSlots(existing, players, asOf, rules = DEMO_RULES) {
  const cutoff = timestamp(asOf);
  requireThat(
    Array.isArray(existing) && existing.length === rules.slots.length,
    'Saved lineup must fill every slot.',
  );
  const byId = new Map(players.map((p) => [p.id, p]));
  const used = new Set();
  const locks = Object.create(null);
  existing.forEach((id, index) => {
    const p = byId.get(id);
    requireThat(
      p && rules.slots[index].positions.includes(p.position),
      `Invalid saved player in slot ${rules.slots[index].id}.`,
    );
    requireThat(!used.has(id), 'Saved lineup repeats a player.');
    used.add(id);
    if (effectiveStart(p) <= cutoff) locks[rules.slots[index].id] = id;
  });
  return locks;
}

function validateOptimizer(players, options) {
  const { rules, count, minUnique, maxExposure, maxNodes, locks, exclude, asOf } = options;
  requireThat(
    Array.isArray(players) && players.length > 0 && players.length <= 32,
    'Optimizer requires 1–32 players.',
  );
  requireThat(
    rules && Array.isArray(rules.slots) && rules.slots.length > 0 && rules.slots.length <= 12,
    'Invalid roster slots.',
  );
  integer(rules.salaryCap, 'Salary cap', 1);
  integer(rules.minTeams, 'Minimum teams', 1, rules.slots.length);
  integer(rules.maxPerTeam, 'Team cap', 1, rules.slots.length);
  const slotIds = new Set();
  rules.slots.forEach((s) => {
    nonempty(s.id, 'Slot ID');
    requireThat(!slotIds.has(s.id), 'Duplicate slot ID.');
    slotIds.add(s.id);
    requireThat(
      Array.isArray(s.positions) &&
        s.positions.length > 0 &&
        s.positions.every((v) => typeof v === 'string'),
      'Invalid slot eligibility.',
    );
  });
  integer(count, 'Lineup count', 1, 3);
  integer(minUnique, 'Minimum unique players', 1, rules.slots.length);
  number(maxExposure, 'Maximum exposure', 0, 1);
  integer(maxNodes, 'Search node limit', 1, 10000000);
  timestamp(asOf);
  requireThat(typeof options.qbStack === 'boolean', 'Stack option must be boolean.');
  requireThat(
    locks && typeof locks === 'object' && !Array.isArray(locks),
    'Locks must be a slot-to-ID object.',
  );
  requireThat(Array.isArray(exclude), 'Exclusions must be an array.');
  const ids = new Set();
  players.forEach((p) => {
    nonempty(p.id, 'Player ID');
    requireThat(!ids.has(p.id), 'Duplicate player ID.');
    ids.add(p.id);
    nonempty(p.team, 'Player team');
    nonempty(p.position, 'Player position');
    integer(p.salary, 'Salary', 1);
    number(p.mean, 'Projection');
    requireThat(['active', 'out'].includes(p.status), 'Unknown player participation status.');
    effectiveStart(p);
  });
  Object.entries(locks).forEach(([slot, id]) => {
    requireThat(slotIds.has(slot) && ids.has(id), `Unknown lock ${slot}:${id}.`);
    const player = players.find((p) => p.id === id);
    requireThat(
      rules.slots.find((s) => s.id === slot).positions.includes(player.position),
      `Ineligible lock for ${slot}.`,
    );
  });
  requireThat(
    new Set(Object.values(locks)).size === Object.values(locks).length,
    'A player cannot be locked twice.',
  );
  exclude.forEach((id) => requireThat(ids.has(id), `Unknown excluded player ${id}.`));
  requireThat(
    !Object.values(locks).some((id) => exclude.includes(id)),
    'Locked player is also excluded.',
  );
}

/**
 * Exact one-lineup branch-and-bound; portfolios are GREEDY sequential optima.
 * A node-budget exception never returns an unproven "optimal" result.
 * Maximum exposure uses floor(requested count × cap); no partial portfolio is published.
 */
export function optimize(players, config = {}) {
  const options = {
    rules: DEMO_RULES,
    count: 1,
    minUnique: 1,
    maxExposure: 1,
    maxNodes: 2000000,
    locks: {},
    exclude: [],
    qbStack: false,
    asOf: undefined,
    ...config,
  };
  validateOptimizer(players, options);
  const { rules, count, minUnique, maxExposure, maxNodes, locks, qbStack, asOf } = options;
  const cutoff = timestamp(asOf);
  const excluded = new Set(options.exclude);
  const lockedIds = new Set(Object.values(locks));
  const cap = Math.floor(count * maxExposure);
  const usage = new Map();
  const lineups = [];
  let nodes = 0;
  for (let round = 0; round < count; round += 1) {
    const pools = rules.slots.map((slot) =>
      players
        .filter((p) => {
          if (
            excluded.has(p.id) ||
            (usage.get(p.id) ?? 0) >= cap ||
            !slot.positions.includes(p.position)
          )
            return false;
          if (Object.hasOwn(locks, slot.id))
            return (
              locks[slot.id] === p.id && (p.status === 'active' || effectiveStart(p) <= cutoff)
            );
          return !lockedIds.has(p.id) && p.status === 'active' && effectiveStart(p) > cutoff;
        })
        .sort((a, b) => b.mean - a.mean || a.id.localeCompare(b.id)),
    );
    if (pools.some((p) => p.length === 0))
      return {
        complete: false,
        lineups: [],
        nodes,
        reason:
          'Greedy construction could not complete the requested portfolio under eligibility, locks and exposure caps. No partial result published; this is not a global infeasibility proof.',
      };
    const remainingMax = Array(rules.slots.length + 1).fill(0);
    const remainingMinCost = Array(rules.slots.length + 1).fill(0);
    for (let i = rules.slots.length - 1; i >= 0; i -= 1) {
      remainingMax[i] = number(
        remainingMax[i + 1] + Math.max(...pools[i].map((p) => p.mean)),
        'Computed objective bound',
      );
      remainingMinCost[i] = remainingMinCost[i + 1] + Math.min(...pools[i].map((p) => p.salary));
    }
    let best = null;
    const selected = [];
    const seen = new Set();
    const teamCounts = new Map();
    function search(index, salary, score) {
      nodes += 1;
      requireThat(
        nodes <= maxNodes,
        'Search budget exceeded; no proven optimum published.',
        'search-budget',
      );
      if (salary + remainingMinCost[index] > rules.salaryCap) return;
      if (best) {
        const scale = Math.max(
          1,
          Math.abs(score),
          Math.abs(remainingMax[index]),
          Math.abs(best.points),
        );
        const roundingSlack = scale * Number.EPSILON * rules.slots.length * 4;
        if (score + remainingMax[index] < best.points - roundingSlack) return;
      }
      if (index === rules.slots.length) {
        if (teamCounts.size < rules.minTeams) return;
        if (
          qbStack &&
          !selected.some(
            (qb) =>
              qb.position === 'QB' &&
              selected.some((r) => ['WR', 'TE'].includes(r.position) && r.team === qb.team),
          )
        )
          return;
        const ids = selected.map((p) => p.id);
        if (lineups.some((l) => ids.filter((id) => !l.ids.includes(id)).length < minUnique)) return;
        const key = [...ids].sort().join('|');
        const assignment = ids.join('|');
        if (
          !best ||
          score > best.points ||
          (score === best.points && `${key}/${assignment}` < `${best.key}/${best.ids.join('|')}`)
        ) {
          best = { ids, points: score, salary, key };
        }
        return;
      }
      const slot = rules.slots[index];
      for (const player of pools[index]) {
        if (seen.has(player.id) || (teamCounts.get(player.team) ?? 0) >= rules.maxPerTeam) continue;
        // Interchangeable adjacent FREE slots: avoid factorial duplicate assignments.
        const previous = rules.slots[index - 1];
        if (
          previous &&
          !Object.hasOwn(locks, slot.id) &&
          !Object.hasOwn(locks, previous.id) &&
          slot.positions.join('|') === previous.positions.join('|') &&
          selected[index - 1].id >= player.id
        )
          continue;
        selected.push(player);
        seen.add(player.id);
        teamCounts.set(player.team, (teamCounts.get(player.team) ?? 0) + 1);
        search(
          index + 1,
          salary + player.salary,
          number(score + player.mean, 'Computed partial objective'),
        );
        selected.pop();
        seen.delete(player.id);
        const amount = teamCounts.get(player.team) - 1;
        if (amount === 0) teamCounts.delete(player.team);
        else teamCounts.set(player.team, amount);
      }
    }
    search(0, 0, 0);
    if (!best)
      return {
        complete: false,
        lineups: [],
        nodes,
        reason:
          'No feasible next lineup in this greedy construction. No partial result published; this is not a global infeasibility proof.',
      };
    lineups.push(best);
    best.ids.forEach((id) => usage.set(id, (usage.get(id) ?? 0) + 1));
  }
  return {
    complete: true,
    lineups,
    nodes,
    exposureDenominator: count,
    method: 'exact per lineup; greedy portfolio',
  };
}

export function walkForward(players, options = {}) {
  requireThat(Array.isArray(players), 'Players must be an array.');
  const predictions = [];
  players.forEach((player) => {
    validateHistory(player.history);
    const history = [...player.history].sort((a, b) => timestamp(a.startAt) - timestamp(b.startAt));
    history.forEach((target) => {
      try {
        const f = forecast(history, target.startAt, options);
        const previous = history.filter((r) => f.usedEventIds.includes(r.eventId));
        const naive = previous.reduce((sum, r) => sum + r.points, 0) / previous.length;
        predictions.push({
          playerId: player.id,
          eventId: target.eventId,
          asOf: target.startAt,
          forecast: f.mean,
          naiveMean: naive,
          actual: target.points,
          trainingIds: f.usedEventIds,
        });
      } catch (error) {
        if (error.code !== 'insufficient-history') throw error;
      }
    });
  });
  const n = predictions.length;
  requireThat(n > 0, 'No eligible walk-forward observations.');
  return {
    n,
    mae: number(
      predictions.reduce((s, p) => s + Math.abs(p.forecast - p.actual), 0) / n,
      'Computed MAE',
    ),
    rmse: number(
      Math.sqrt(predictions.reduce((s, p) => s + (p.forecast - p.actual) ** 2, 0) / n),
      'Computed RMSE',
    ),
    naiveMae: number(
      predictions.reduce((s, p) => s + Math.abs(p.naiveMean - p.actual), 0) / n,
      'Computed baseline MAE',
    ),
    predictions,
  };
}

export function americanToDecimal(odds) {
  number(odds, 'American odds');
  requireThat(Math.abs(odds) >= 100, 'American odds must be ≤ −100 or ≥ +100.');
  const decimal = odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds;
  return number(decimal, 'Converted decimal odds', 1 + Number.EPSILON);
}
export function expectedValue(decimalOdds, winProbability, pushProbability = 0) {
  number(decimalOdds, 'Decimal odds', 1 + Number.EPSILON);
  number(winProbability, 'Win probability', 0, 1);
  number(pushProbability, 'Push probability', 0, 1);
  requireThat(winProbability + pushProbability <= 1, 'Win + push probability exceeds 1.');
  const loseProbability = 1 - (winProbability + pushProbability);
  return winProbability * (decimalOdds - 1) - loseProbability;
}
export function noVigTwoWay(firstOdds, secondOdds) {
  number(firstOdds, 'First decimal odds', 1 + Number.EPSILON);
  number(secondOdds, 'Second decimal odds', 1 + Number.EPSILON);
  const first = 1 / firstOdds;
  const second = 1 / secondOdds;
  return [first / (first + second), second / (first + second)];
}

/** Spreadsheet-injection protection as well as normal RFC4180-style quoting. */
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCsv(rows) {
  requireThat(Array.isArray(rows) && rows.every(Array.isArray), 'CSV expects arrays of rows.');
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
