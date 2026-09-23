import { escapeHtml as e } from './html.mjs';
import { DEMO_RULES } from './engine.mjs';

const salary = (value) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const fixed = (value, digits = 2) => Number(value).toFixed(digits);

export function projectionRows(players) {
  return players
    .map(
      (p) =>
        `<tr${p.status === 'out' ? ' class="out-row"' : ''}><td><span class="projection-name">${e(p.name)}<small>${e(p.team)} · ${p.status === 'out' ? 'OUT · excluded from new additions' : 'Fictional player'}</small></span></td><td><span class="pos-pill">${e(p.position)}</span></td><td>${salary(p.salary)}</td><td class="mean-cell">${fixed(p.mean)}</td><td>${fixed(p.value)}</td><td>${fixed(p.p10, 1)}–${fixed(p.p90, 1)}</td></tr>`,
    )
    .join('');
}
export function lineupTabs(run, active = 0) {
  return (run.result?.lineups ?? [])
    .map(
      (_, i) =>
        `<button class="lineup-tab" type="button" data-lineup="${i}" aria-pressed="${i === active}">Lineup ${i + 1}</button>`,
    )
    .join('');
}
export function lineupView(run, index = 0) {
  const lineup = run.result?.lineups?.[index];
  if (!lineup) return '<p class="empty-state">No complete lineup set is available.</p>';
  const byId = new Map(run.players.map((p) => [p.id, p]));
  return `<div class="lineup-totals"><div><span>SUM OF FIXTURE MEANS</span><strong>${fixed(lineup.points)}</strong></div><div><span>SALARY / 50,000</span><strong>${salary(lineup.salary)}</strong></div></div><ol class="lineup-players">${lineup.ids
    .map((id, i) => {
      const p = byId.get(id);
      const slot = DEMO_RULES.slots[i].id;
      const locked = run.locks?.[slot] === id;
      return `<li><span class="slot-label">${slot}</span><span class="lineup-player">${e(p.name)}${locked ? '<span class="locked-label">LOCKED</span>' : ''}<small>${e(p.team)} · ${salary(p.salary)} salary units</small></span><span class="lineup-points">${fixed(p.mean)}</span></li>`;
    })
    .join('')}</ol>`;
}
export function labSummary(run) {
  const stats = [
    [run.players.length, 'Fictional players', 'No real athletes'],
    [run.result?.lineups?.length ?? 0, 'Feasible demo lineups', 'Distinct player sets'],
    [
      run.result?.lineups?.length ? fixed(run.result.lineups[0].points) : '—',
      'Best sum of means',
      'Unrounded inputs used',
    ],
    [Object.keys(run.locks ?? {}).length, 'Frozen roster slots', 'Exact slot preservation'],
  ];
  return stats
    .map(
      ([value, label, note]) =>
        `<div class="lab-metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`,
    )
    .join('');
}
export function chartView(run) {
  const points = run.evaluation.predictions.filter((p) => p.playerId === 'atlas-qb');
  const width = 530;
  const height = 172;
  const left = 32;
  const right = 16;
  const top = 12;
  const bottom = 28;
  const max = Math.ceil(Math.max(...points.flatMap((p) => [p.forecast, p.actual])) / 10) * 10;
  const x = (i) => left + (i / Math.max(1, points.length - 1)) * (width - left - right);
  const y = (v) => height - bottom - (v / max) * (height - top - bottom);
  const path = (key) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fixed(x(i))},${fixed(y(p[key]))}`).join(' ');
  return `<svg class="backtest-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">Synthetic walk-forward forecasts and outcomes</title><desc id="chart-desc">${points.length} fictional Atlas Quarterback events. Solid teal is the pre-event forecast; dashed blue is the invented outcome. This is not real sports performance.</desc>${[0, max / 3, (2 * max) / 3, max].map((v) => `<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-label" x="3" y="${y(v) + 3}">${fixed(v, 0)}</text>`).join('')}<path class="chart-actual" d="${path('actual')}"/><path class="chart-prediction" d="${path('forecast')}"/>${points.map((p, i) => `<circle class="chart-point" cx="${x(i)}" cy="${y(p.forecast)}" r="3"/><text class="chart-label" text-anchor="middle" x="${x(i)}" y="${height - 7}">E${i + 4}</text>`).join('')}</svg>`;
}
export function evaluationView(run) {
  const stats = [
    [fixed(run.evaluation.mae, 3), 'Fixture mean absolute error'],
    [fixed(run.evaluation.naiveMae, 3), 'Unweighted mean baseline MAE'],
    [run.evaluation.n, 'Synthetic held-out player-events'],
  ];
  return stats
    .map(([value, name]) => `<div><small>${name}</small><strong>${value}</strong></div>`)
    .join('');
}
