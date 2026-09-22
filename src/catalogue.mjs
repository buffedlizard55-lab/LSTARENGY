import { createHash } from 'node:crypto';

export const FEATURE_KINDS = ['Vendor-described', 'Observed navigation', 'Unverified'];
export const BUILD_STATES = ['Prototype', 'Planned', 'Blocked'];
export const ACCESS_STATES = ['Premium documented', 'Free described', 'Not verified'];
export const BLOCKED_MONITOR_HOSTS = [
  'linestarapp.com',
  'www.linestarapp.com',
  'linestar.gitbook.io',
];

export function digest(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function validateCatalogue(data, audit, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const warnings = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const isoDate = (d) =>
    typeof d === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  if (!data || typeof data !== 'object') return { errors: ['Catalogue is required.'], warnings };
  expect(data.schemaVersion === 1, 'Unsupported catalogue schema.');
  expect(
    isoDate(data.reviewedOn) && data.reviewedOn <= today,
    'Review date is invalid or future-dated.',
  );
  expect(
    text(data.scope) && text(data.methodology),
    'Scope and verification limitations are required.',
  );
  const sourceIds = new Set();
  const references = new Set();
  const urls = new Set();
  for (const source of data.sources ?? []) {
    expect(
      /^S\d{2}$/.test(source.id) && !sourceIds.has(source.id),
      `Duplicate/invalid source ID ${source.id}.`,
    );
    sourceIds.add(source.id);
    expect(!urls.has(source.url), `Duplicate source URL ${source.url}.`);
    urls.add(source.url);
    try {
      const url = new URL(source.url);
      expect(
        url.protocol === 'https:' && !url.username && !url.password,
        `${source.id} needs a credential-free HTTPS URL.`,
      );
      expect(
        !BLOCKED_MONITOR_HOSTS.includes(url.hostname) || source.monitor === false,
        `${source.id}: LineStar automated monitoring must remain disabled.`,
      );
    } catch {
      errors.push(`${source.id}: invalid URL.`);
    }
    expect(
      isoDate(source.observedOn) && source.observedOn <= data.reviewedOn,
      `${source.id}: invalid observation date.`,
    );
    expect(
      ['title', 'publisher', 'kind', 'method'].every((k) => text(source[k])),
      `${source.id}: publisher/method metadata missing.`,
    );
    expect(typeof source.monitor === 'boolean', `${source.id}: monitoring policy missing.`);
    expect(
      Array.isArray(source.excerpts) && source.excerpts.length > 0,
      `${source.id}: no captured excerpts.`,
    );
    let words = 0;
    for (const excerpt of source.excerpts ?? []) {
      const ref = `${source.id}:${excerpt.id}`;
      expect(text(excerpt.id) && !references.has(ref), `${ref}: duplicate/empty excerpt ID.`);
      references.add(ref);
      expect(text(excerpt.text) && text(excerpt.locator), `${ref}: excerpt and location required.`);
      expect(
        typeof excerpt.text === 'string' && digest(excerpt.text) === excerpt.sha256,
        `${ref}: excerpt integrity hash mismatch.`,
      );
      words += (excerpt.text ?? '').trim().split(/\s+/).length;
    }
    expect(words <= 200, `${source.id}: keep excerpts short (over 200 words).`);
  }
  expect(sourceIds.size > 0, 'At least one observed source is required.');
  const checkRefs = (refs, context, required = false) => {
    expect(Array.isArray(refs), `${context}: references must be an array.`);
    if (!Array.isArray(refs)) return;
    if (required) expect(refs.length > 0, `${context}: claim lacks evidence.`);
    refs.forEach((ref) => expect(references.has(ref), `${context}: unknown evidence ${ref}.`));
  };
  const checkSourceIds = (ids, context) => {
    expect(Array.isArray(ids), `${context}: source IDs must be an array.`);
    (ids ?? []).forEach((id) => expect(sourceIds.has(id), `${context}: unknown source ${id}.`));
  };
  for (const collection of ['features', 'findings', 'inputs', 'flags', 'roadmap']) {
    const ids = new Set();
    expect(
      Array.isArray(data[collection]) && data[collection].length > 0,
      `${collection}: missing records.`,
    );
    for (const row of data[collection] ?? []) {
      expect(text(row.id) && !ids.has(row.id), `${collection}: duplicate/empty ID ${row.id}.`);
      ids.add(row.id);
      expect(text(row.title), `${row.id}: title required.`);
      if (collection === 'features') {
        expect(FEATURE_KINDS.includes(row.kind), `${row.id}: invalid evidence kind.`);
        expect(BUILD_STATES.includes(row.implementation), `${row.id}: invalid build status.`);
        expect(ACCESS_STATES.includes(row.access), `${row.id}: invalid access status.`);
        expect(
          ['claim', 'scope', 'plan', 'caveat'].every((k) => text(row[k])),
          `${row.id}: missing scope, claim or limitations.`,
        );
        checkRefs(row.evidence, row.id, row.kind !== 'Unverified');
        checkRefs(row.accessEvidence, `${row.id} access`, row.access !== 'Not verified');
      } else if (collection === 'findings' || collection === 'inputs') {
        checkRefs(row.evidence, row.id, true);
        if (collection === 'inputs') checkSourceIds(row.candidates, row.id);
      } else if (collection === 'flags') {
        expect(
          ['Critical', 'High', 'Medium'].includes(row.severity),
          `${row.id}: invalid severity.`,
        );
        expect(text(row.detail) && text(row.action), `${row.id}: review action missing.`);
        checkRefs(row.evidence, row.id);
      } else {
        checkSourceIds(row.refs, row.id);
        expect(
          Array.isArray(row.tasks) && row.tasks.length > 0 && text(row.done),
          `${row.id}: acceptance criteria required.`,
        );
      }
    }
  }
  expect(
    Array.isArray(data.sports) &&
      new Set(data.sports.map((s) => s.label)).size === data.sports.length,
    'Sport labels must be unique.',
  );
  (data.sports ?? []).forEach((sport) => {
    checkRefs(sport.evidence, sport.label, true);
    checkSourceIds(sport.candidates, sport.label);
    expect(sport.status === 'Not integrated', `${sport.label}: do not imply a live integration.`);
  });
  if (audit) {
    expect(/^[a-f0-9]{40}$/.test(audit.baseCommit), 'Audit needs an immutable base commit.');
    expect(audit.reviewedOn === data.reviewedOn, 'Audit and catalogue review dates differ.');
    expect(Array.isArray(audit.entries) && audit.entries.length > 0, 'Legacy audit required.');
    (audit.entries ?? []).forEach((entry, i) => {
      expect(
        /^[a-f0-9]{64}$/.test(entry.originalLineSha256),
        `Audit ${i}: original line digest required.`,
      );
      expect(['README.md', 'docs/index.html'].includes(entry.file), `Audit ${i}: unexpected file.`);
      expect(
        Number.isInteger(entry.start) &&
          Number.isInteger(entry.end) &&
          entry.start > 0 &&
          entry.end >= entry.start,
        `Audit ${i}: invalid original line range.`,
      );
      expect(
        text(entry.subject) && text(entry.review),
        `Audit ${i}: missing disposition rationale.`,
      );
      checkRefs(entry.evidence, `Audit ${i}`);
    });
  }
  if (isoDate(data.reviewedOn) && (Date.parse(today) - Date.parse(data.reviewedOn)) / 86400000 > 30)
    warnings.push(
      'Research snapshot is more than 30 days old. This does not automatically re-verify or invalidate the dated observations.',
    );
  return { errors, warnings };
}

export { escapeHtml } from './html.mjs';
