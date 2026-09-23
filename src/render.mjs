import { escapeHtml as e } from './html.mjs';
import {
  projectionRows,
  lineupTabs,
  lineupView,
  labSummary,
  chartView,
  evaluationView,
} from './view.mjs';
import { SCENARIOS } from './demo.mjs';

const paths = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  features: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  lab: '<path d="M9 3h6M10 3v6l-6 10a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10"/>',
  roadmap:
    '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v9a3 3 0 0 0 3 3h7M6 11h8a4 4 0 0 0 0-8h-2"/>',
  review: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.01"/>',
  sources: '<path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6"/>',
  git: '<path d="M8 3v10a4 4 0 0 0 4 4h4M8 7h8"/><circle cx="8" cy="3" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="18" cy="17" r="2"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.sources}</svg>`;
}
const kinds = {
  'Vendor-described': 'documented',
  'Observed navigation': 'observed',
  Unverified: 'unknown',
};
const stateClass = (value) => value.toLowerCase();

export function renderTokens(data, run, health = { results: [] }) {
  const healthMap = new Map(health.results.map((r) => [r.sourceId, r]));
  const sourceMap = new Map(data.sources.map((s) => [s.id, s]));
  function refs(items) {
    return [...new Set(items)]
      .map((ref) => {
        const [id, excerpt] = ref.split(':');
        return `<a class="source-ref" href="#evidence-${e(id)}-${e(excerpt)}" title="${e(sourceMap.get(id).title)} — ${e(excerpt)}" aria-label="${e(id)}, evidence: ${e(excerpt)}">${e(id)}</a>`;
      })
      .join('');
  }
  function sourceLinks(ids) {
    return ids.length
      ? ids
          .map(
            (id) =>
              `<a class="source-ref" href="#source-${id}" title="${e(sourceMap.get(id).title)}">${id}</a>`,
          )
          .join('')
      : '<span>No approved candidate established</span>';
  }
  const nav = [
    ['overview', 'Overview'],
    ['features', 'Capabilities'],
    ['data', 'Data sources'],
    ['lab', 'Projection lab'],
    ['roadmap', 'Build roadmap'],
    ['review', 'Review flags'],
    ['sources', 'Evidence register'],
  ];
  const statItems = [
    [data.features.length, 'Capabilities catalogued', 'Publicly described or flagged', 'features'],
    [data.sources.length, 'Reviewed references', 'Primary & maintainer sources', 'sources'],
    [data.sports.length, 'Sport labels observed', 'Not verified active coverage', 'data'],
    [data.flags.length, 'Open review flags', 'Uncertainty kept visible', 'review'],
  ];
  return {
    LOGO: '<svg viewBox="0 0 34 34" fill="none"><path d="M4 25V14h6v11M14 25V5h6v20M24 25V10h6v15" stroke="currentColor" stroke-width="2.2"/><path d="M3 30h28" stroke="currentColor" stroke-width="2.2"/></svg>',
    GIT_ICON: icon('git'),
    SEARCH_ICON: icon('search'),
    NAV: nav
      .map(
        ([id, title]) =>
          `<a class="nav-link${id === 'overview' ? ' active' : ''}" href="#${id}"${id === 'overview' ? ' aria-current="location"' : ''}>${icon(id)}<span>${title}</span>${id === 'review' ? `<span class="nav-count">${data.flags.length}</span>` : ''}</a>`,
      )
      .join('\n'),
    DATE: data.reviewedOn,
    DATE_HUMAN: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(data.reviewedOn)),
    STATS: statItems
      .map(
        ([value, label, note, shape]) =>
          `<div class="stat-card"><div class="stat-top"><strong>${value}</strong>${icon(shape)}</div><h3>${label}</h3><p>${note}</p></div>`,
      )
      .join(''),
    FINDINGS: data.findings
      .map(
        (f) =>
          `<details class="finding"><summary><span>${f.id}</span><strong>${e(f.title)}</strong><span class="expand-icon" aria-hidden="true">+</span></summary><p>${e(f.claim)}</p><div><span class="evidence-label">${e(f.kind)}</span>${refs(f.evidence)}</div></details>`,
      )
      .join('\n'),
    SCOPE: e(data.scope),
    METHODOLOGY: e(data.methodology),
    HEALTH_SUMMARY: health.results.length
      ? `${health.results.filter((r) => r.status === 'reachable-not-reverified').length} reachable; ${health.results.filter((r) => r.status === 'network-error').length} network-level failures; ${health.results.filter((r) => r.status === 'skipped-policy').length} skipped by policy. These are recorded attempt results, not current uptime or claim verification.`
      : 'No automated availability report recorded.',
    CATEGORY_OPTIONS: [...new Set(data.features.map((f) => f.category))]
      .map((c) => `<option>${e(c)}</option>`)
      .join(''),
    FEATURE_COUNT: data.features.length,
    FLAG_COUNT: data.flags.length,
    SOURCE_COUNT: data.sources.length,
    SPORT_COUNT: data.sports.length,
    FEATURES: data.features
      .map(
        (f) =>
          `<article class="feature" id="feature-${f.id}" data-category="${e(f.category)}" data-kind="${e(f.kind)}"><details><summary class="feature-summary"><span class="feature-title"><span class="feature-id">${f.id}</span>${e(f.title)}<small>${e(f.scope)}</small></span><span class="badge ${kinds[f.kind]}">${e(f.kind)}</span><span class="access-label">${e(f.access)}</span><span class="badge build-badge ${stateClass(f.implementation)}">${e(f.implementation)}</span><span class="expand-icon" aria-hidden="true">+</span></summary><div class="feature-body"><div class="claim-detail"><h4>Public claim · ${e(f.category)}</h4><p>${e(f.claim)}</p><p>${refs(f.evidence) || '<span class="badge unknown">No supporting primary excerpt established</span>'}</p><p class="detail-note"><strong>Access: ${e(f.access)}.</strong> ${refs(f.accessEvidence)} ${f.access === 'Not verified' ? 'No per-feature access test was performed.' : 'This is documented inclusion or advertised access, not a test of every current limit.'}</p></div><div class="build-detail"><h4>Independent build · ${e(f.implementation)}</h4><p>${e(f.plan)}</p><p class="detail-note"><strong>Limit:</strong> ${e(f.caveat)}</p><div class="input-tags">${f.inputs.map((i) => `<span>${e(i)}</span>`).join('')}</div></div></div></details></article>`,
      )
      .join('\n'),
    INPUTS: data.inputs
      .map(
        (d) =>
          `<article class="data-card"><span class="card-id">${d.id} / PROPOSED INPUT</span><h3>${e(d.title)}</h3><p>${e(d.need)}</p><div class="candidate-line">Candidate references<br>${sourceLinks(d.candidates)}</div><details><summary>Evidence, automation & rights gate</summary><p>${e(d.vendor)} ${refs(d.evidence)}</p><p><strong>Automation:</strong> ${e(d.automation)}</p><p class="gate-note">${e(d.gate)}</p></details></article>`,
      )
      .join('\n'),
    SPORTS: data.sports
      .map(
        (s) =>
          `<tr><td>${e(s.label)}<br>${refs(s.evidence)}</td><td>${e(s.proposal)}</td><td>${e(s.gate)}<br>${sourceLinks(s.candidates)}</td></tr>`,
      )
      .join('\n'),
    SCENARIOS: SCENARIOS.map((s) => `<option value="${s.id}">${e(s.title)}</option>`).join(''),
    SCENARIO_DESCRIPTION: e(run.scenario.detail),
    LAB_SUMMARY: labSummary(run),
    PROJECTIONS: projectionRows(
      [...run.players].sort((a, b) => b.mean - a.mean || a.id.localeCompare(b.id)),
    ),
    LINEUP_TABS: lineupTabs(run),
    LINEUP: lineupView(run),
    CHART: chartView(run),
    EVALUATION: evaluationView(run),
    EV: `+${run.ev.perUnit.toFixed(4)}`,
    ROADMAP: data.roadmap
      .map(
        (r) =>
          `<article class="roadmap-card"><div class="roadmap-top"><span class="card-id">${r.id}</span><span class="priority-tag">${r.priority}</span><span class="roadmap-session">${e(r.session)}</span></div><h3>${e(r.title)}</h3><p class="roadmap-status">${e(r.status)}</p><ol>${r.tasks.map((t) => `<li>${e(t)}</li>`).join('')}</ol><p class="acceptance"><strong>Done when</strong>${e(r.done)}</p>${r.refs.length ? sourceLinks(r.refs) : ''}</article>`,
      )
      .join('\n'),
    FLAGS: data.flags
      .map(
        (f) =>
          `<details class="review-item" id="flag-${f.id}"><summary><span class="card-id">${f.id}</span><span class="badge ${stateClass(f.severity)}">${f.severity}</span><strong>${e(f.title)}</strong><span class="expand-icon" aria-hidden="true">+</span></summary><p>${e(f.detail)}</p><p class="review-action"><strong>Next action:</strong> ${e(f.action)}</p>${refs(f.evidence)}</details>`,
      )
      .join('\n'),
    SOURCES: data.sources
      .map(
        (s) =>
          `<details class="source-item" id="source-${s.id}"><summary><span class="source-number">${s.id}</span><span class="source-heading">${e(s.title)}<small>${e(s.publisher)} · observed ${s.observedOn}</small></span><span class="source-type">${e(s.kind)}</span><span class="expand-icon" aria-hidden="true">+</span></summary><div class="source-content"><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">Open source ↗ &nbsp; ${e(s.url)}</a><p class="source-note">${e(s.notes || 'Use this description only within its stated scope. No accuracy or current entitlement guarantee.')}</p><p class="source-meta">${e(s.method)}<br>Automated availability monitoring: ${s.monitor ? 'allowlisted public documentation only' : 'disabled; no automatic re-verification'}<br>Recorded check: ${e(healthMap.get(s.id)?.status ?? 'not attempted')} · ${e(healthMap.get(s.id)?.checkedAt ?? 'no timestamp')}. Evidence date unchanged.</p><ul class="excerpt-list">${s.excerpts.map((q) => `<li class="excerpt" id="evidence-${s.id}-${q.id}"><span class="excerpt-id">${s.id}:${e(q.id)}</span><blockquote cite="${e(s.url)}">“${e(q.text)}”</blockquote><div class="locator">Location: ${e(q.locator)}</div><code>Excerpt SHA-256: ${q.sha256}</code></li>`).join('')}</ul></div></details>`,
      )
      .join('\n'),
  };
}

export function auditMarkdown(audit, catalogue) {
  const sources = new Map(catalogue.sources.map((s) => [s.id, s]));
  const clean = (v) => v.replaceAll('|', '\\|').replaceAll('\n', ' ');
  return (
    `# Line-referenced review of the original repository\n\nReviewed: ${audit.reviewedOn}. Original commit: \`${audit.baseCommit}\`.\n\n${audit.scope}\n\nEach row covers the original substantive claim or group of claims, not the current generated HTML. A retained source statement is not independent confirmation of its performance claims. Uninspected old sources are explicitly not certified.\n\n| Original file / lines | Claim group | Disposition | Review and primary references |\n| --- | --- | --- | --- |\n` +
    audit.entries
      .map((r) => {
        const url = `https://github.com/buffedlizard55-lab/LSTARENGY/blob/${audit.baseCommit}/${r.file}#L${r.start}-L${r.end}`;
        const links = [...new Set(r.evidence.map((ref) => ref.split(':')[0]))]
          .map((id) => `[${id}](${sources.get(id).url})`)
          .join(' ');
        return `| [${r.file}:${r.start}–${r.end}](${url}) | ${clean(r.subject)} | ${clean(r.disposition)} | ${clean(r.review)} ${links} |`;
      })
      .join('\n') +
    '\n'
  );
}
export function handoffMarkdown(data) {
  return (
    `# Next-session handoff\n\nResearch snapshot: ${data.reviewedOn}.\n\n## Start here\n\n1. Read README, this handoff, model-card.md, legacy-audit.md and review-passes.md.\n2. Run \`npm ci\`, \`npm run check\`, \`npm run demo\` and \`npm run test:browser\` (Chromium installation required for browser tests).\n3. Do not scrape LineStar, ingest its projections, or treat the synthetic demo as a live system. Rights and dataset availability are unresolved, not chores to silently bypass.\n4. Preserve source observation dates. Build dates and HTTP reachability do not re-verify claims.\n5. This session uses only \`arena/01a0cb4a-lstarengy\`; no data branch is required.\n\n## Delivery and infrastructure constraints\n\nThe existing Pages configuration is \`main:/\`. The integration could read Pages settings but returned HTTP 403 on configuration changes. Both root and docs entrypoints are generated, so the existing configuration can serve the site after merge without that permission. Static Pages is not a live sports backend. Do not store API credentials in public files or request them in chat; configure approved backend secrets through the hosting platform when authorized.\n\n` +
    data.roadmap
      .map(
        (r) =>
          `## ${r.id} · ${r.priority} · ${r.title}\n\n**When:** ${r.session}. **State:** ${r.status}.\n\n${r.tasks.map((t) => `- ${t}`).join('\n')}\n\n**Acceptance:** ${r.done}\n`,
      )
      .join('\n') +
    `\n## What not to assume\n\n- The public inventory is not exhaustive coverage of authenticated screens.\n- Unknown feature access is not synonymous with paid-only.\n- No live feeds, real held-out sports evaluation, calibrated ownership/props, or LineStar-quality measurement is delivered.\n- This project does not provide an IP/legal opinion. The four patent numbers are vendor-listed, not an independently verified freedom-to-operate analysis.\n- No secret, subscription, user upload, or manual data input is required to run the delivered fixture prototype. Real-feed authorization and legal judgment cannot be automatically manufactured.\n`
  );
}
