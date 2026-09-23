import { SCENARIOS, projectionCsv, lineupCsv } from './demo.mjs';
import {
  projectionRows,
  lineupTabs,
  lineupView,
  labSummary,
  chartView,
  evaluationView,
} from './view.mjs';

const byId = (id) => document.getElementById(id);
const features = [...document.querySelectorAll('.feature')];
const search = byId('feature-search');
const category = byId('category-filter');
const evidence = byId('evidence-filter');
let showAll = false;
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('en-US').trim();
const featureText = new Map(features.map((f) => [f, normalize(f.textContent)]));

function filterFeatures() {
  const query = normalize(search.value);
  const matched = features.filter(
    (f) =>
      (!category.value || f.dataset.category === category.value) &&
      (!evidence.value || f.dataset.kind === evidence.value) &&
      featureText.get(f).includes(query),
  );
  const displayed = new Set(showAll ? matched : matched.slice(0, 8));
  features.forEach((f) => {
    f.hidden = !displayed.has(f);
  });
  byId('feature-count').textContent =
    `Showing ${displayed.size} of ${matched.length} matching capabilities · ${features.length} total`;
  byId('feature-empty').hidden = matched.length !== 0;
  const button = byId('show-features');
  button.hidden = matched.length <= 8;
  button.textContent = showAll
    ? 'Show fewer capabilities'
    : `Show all ${matched.length} capabilities`;
  button.setAttribute('aria-expanded', String(showAll));
}
function resetFeatures() {
  search.value = '';
  category.value = '';
  evidence.value = '';
  showAll = false;
  filterFeatures();
}
byId('feature-controls').hidden = false;
search.addEventListener('input', () => {
  showAll = false;
  filterFeatures();
});
[category, evidence].forEach((select) =>
  select.addEventListener('change', () => {
    showAll = false;
    filterFeatures();
  }),
);
byId('reset-filters').addEventListener('click', resetFeatures);
byId('show-features').addEventListener('click', () => {
  showAll = !showAll;
  filterFeatures();
});
filterFeatures();

// Deep citations work even when a source or feature is collapsed / filtered out.
function revealHash() {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (!id) return;
  const target = byId(id);
  if (!target) return;
  const feature = target.closest('.feature');
  if (feature) {
    resetFeatures();
    showAll = true;
    filterFeatures();
    feature.querySelector('details').open = true;
  }
  let parent = target;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  if (id.startsWith('evidence-') || id.startsWith('source-') || feature)
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
window.addEventListener('hashchange', revealHash);
revealHash();

const nav = [...document.querySelectorAll('.nav-link')];
const sections = nav.map((link) => ({
  link,
  element: document.querySelector(link.getAttribute('href')),
}));
let scrollQueued = false;
function updateNav() {
  let current = sections[0];
  for (const item of sections) if (item.element.getBoundingClientRect().top <= 150) current = item;
  nav.forEach((link) => {
    const active = link === current.link;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  byId('current-section').textContent = current.link.querySelector('span').textContent;
  scrollQueued = false;
}
window.addEventListener(
  'scroll',
  () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateNav);
    }
  },
  { passive: true },
);
updateNav();

const snapshot = document.querySelector('#snapshot-age time').dateTime;
const age = Math.floor((Date.now() - Date.parse(`${snapshot}T00:00:00Z`)) / 86400000);
if (age > 30) {
  const note = document.createElement('p');
  note.textContent = `Review reminder: this research snapshot is ${age} days old. Current prices, access, policy and coverage have not been automatically re-verified.`;
  note.className = 'gate-note';
  byId('snapshot-age').after(note);
}

let run = null;
let activeLineup = 0;
let requestId = 0;
let worker;
let watchdog;
const WORKER_TIMEOUT_MS = 10000;
const exports = [byId('export-projections'), byId('export-lineups')];
function setBusy(busy) {
  byId('run-demo').disabled = busy;
  byId('scenario-select').disabled = busy;
  byId('demo-output').setAttribute('aria-busy', String(busy));
  exports.forEach((button) => {
    button.disabled = busy || !run?.quality.ok || !run?.result?.complete;
  });
}
function showError(message) {
  clearTimeout(watchdog);
  run = null;
  byId('demo-output').hidden = true;
  byId('demo-status').className = 'demo-status error';
  byId('demo-status').textContent =
    `Output blocked: ${message} No forecast or CSV is published for this run.`;
  setBusy(false);
}
function renderPlayers() {
  if (!run?.quality.ok) return;
  const position = byId('position-filter').value;
  const sort = byId('projection-sort').value;
  const players = run.players.filter((p) => !position || p.position === position);
  players.sort(
    (a, b) =>
      (sort === 'salary' ? a.salary - b.salary : b[sort] - a[sort]) || a.id.localeCompare(b.id),
  );
  byId('projection-rows').innerHTML = projectionRows(players);
}
function renderLineup(index) {
  if (
    !run?.result?.complete ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= run.result.lineups.length
  )
    return;
  activeLineup = index;
  byId('lineup-tabs').innerHTML = lineupTabs(run, activeLineup);
  byId('lineup-content').innerHTML = lineupView(run, activeLineup);
}
function acceptRun(next) {
  clearTimeout(watchdog);
  if (!next || typeof next.quality?.ok !== 'boolean') {
    showError('The research worker returned an invalid result.');
    return;
  }
  if (!next.quality.ok) {
    showError(next.quality.errors.join(' '));
    return;
  }
  if (!next.result?.complete) {
    showError(next.result?.reason ?? 'Optimizer did not produce a complete result.');
    return;
  }
  run = next;
  activeLineup = 0;
  byId('demo-output').hidden = false;
  byId('lab-summary').innerHTML = labSummary(run);
  renderPlayers();
  renderLineup(0);
  document.querySelector('.backtest-chart').outerHTML = chartView(run);
  document.querySelector('.evaluation-strip').innerHTML = evaluationView(run);
  byId('demo-status').className = 'demo-status';
  byId('demo-status').textContent =
    `Fixture checks passed · simulated as-of ${run.asOf} · ${run.result.lineups.length} complete lineup${run.result.lineups.length === 1 ? '' : 's'} · no live data.` +
    (run.changedPlayer
      ? ` Simulated scratch: ${run.changedPlayer}. ${Object.keys(run.locks).length} original slots frozen.`
      : '');
  setBusy(false);
}
function execute() {
  if (!worker) {
    showError('The browser worker is unavailable. Use the repository CLI to run this prototype.');
    return;
  }
  const id = byId('scenario-select').value;
  const scenario = SCENARIOS.find((s) => s.id === id);
  byId('scenario-description').textContent = scenario?.detail ?? 'Unknown scenario.';
  requestId += 1;
  setBusy(true);
  byId('demo-output').hidden = true;
  byId('demo-status').className = 'demo-status loading';
  byId('demo-status').textContent =
    'Checking fixture data and solving the selected research scenario…';
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    worker?.terminate();
    worker = null;
    showError(
      'The research worker exceeded its ten-second deadline. Reload to retry or use the repository CLI.',
    );
  }, WORKER_TIMEOUT_MS);
  worker.postMessage({ id, requestId });
}
byId('lab-controls').hidden = false;
byId('player-controls').hidden = false;
exports.forEach((button) => {
  button.disabled = true;
});
byId('position-filter').addEventListener('change', renderPlayers);
byId('projection-sort').addEventListener('change', renderPlayers);
byId('lineup-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-lineup]');
  if (button) {
    const index = Number(button.dataset.lineup);
    renderLineup(index);
    byId('lineup-tabs').querySelector(`[data-lineup="${index}"]`)?.focus({ preventScroll: true });
  }
});
byId('run-demo').addEventListener('click', execute);
byId('scenario-select').addEventListener('change', execute);

function download(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
exports[0].addEventListener('click', () => {
  if (run?.result?.complete)
    download(projectionCsv(run), `synthetic-${run.scenario.id}-projections.csv`);
});
exports[1].addEventListener('click', () => {
  if (run?.result?.complete) download(lineupCsv(run), `synthetic-${run.scenario.id}-lineups.csv`);
});
try {
  worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event) => {
    if (!worker || event.data?.requestId !== requestId) return;
    if (event.data.error) showError(event.data.error);
    else acceptRun(event.data.run);
  });
  worker.addEventListener('error', () => {
    worker?.terminate();
    worker = null;
    showError('The research worker could not load or finish.');
  });
  execute();
} catch {
  worker = null;
  showError('Your browser could not start the research worker.');
}
