# Next-session handoff

Research snapshot: 2026-09-22.

## Start here

1. Read README, this handoff, model-card.md, legacy-audit.md and review-passes.md.
2. Run `npm ci`, `npm run check`, `npm run demo` and `npm run test:browser` (Chromium installation required for browser tests).
3. Do not scrape LineStar, ingest its projections, or treat the synthetic demo as a live system. Rights and dataset availability are unresolved, not chores to silently bypass.
4. Preserve source observation dates. Build dates and HTTP reachability do not re-verify claims.
5. This session uses only `arena/01a0cb4a-lstarengy`; no data branch is required.

## Delivery and infrastructure constraints

The existing Pages configuration is `main:/`. The integration could read Pages settings but returned HTTP 403 on configuration changes. Both root and docs entrypoints are generated, so the existing configuration can serve the site after merge without that permission. Static Pages is not a live sports backend. Do not store API credentials in public files or request them in chat; configure approved backend secrets through the hosting platform when authorized.

## N01 · P0 · Resolve rights and define a single-sport contract

**When:** Next session. **State:** Blocked on authorization.

- Review vendor restrictions and patent claims with qualified counsel; do not assume independent code grants clearance.
- Select NFL as a proposed pilot and obtain automated salary / eligibility / status feed rights.
- Create a dataset-specific rights manifest including storage, derived-use and redistribution permissions.

**Acceptance:** Documented rights for every required field, approved endpoints, and a negative test proving unauthorized sources cannot be ingested.

## N02 · P0 · Build authorized ingestion, IDs and quality gates

**When:** Next session, after N01. **State:** Not started.

- Use stable athlete / team / slate IDs and store event time, available-at time, source, license, schema and payload hash.
- Add retry/backoff, bounded downloads, rate limits, timezone handling, duplicate checks and correction history.
- Quarantine missing, conflicting, stale or out-of-range critical inputs; never substitute synthetic data into a live output.

**Acceptance:** Replayable licensed historical snapshots plus tests for renamed players, trades, postponements, partial feeds and late scratches.

## N03 · P1 · Measure a real baseline before adding complexity

**When:** Following session. **State:** Not started.

- Freeze train/validation/test dates; fit role × rate models only on information available before the prediction cutoff.
- Report MAE / RMSE for point means, quantile loss / interval coverage for ranges, calibration / log loss for prop probabilities.
- Compare to naïve historical baselines by sport, position and news regime; report sample sizes and uncertainty.
- Only promote a model after a preregistered improvement criterion on held-out data; retain rollback artifacts.

**Acceptance:** Reproducible real-data evaluation, no leakage, versioned scoring including nonlinear bonuses, and no profitability or vendor-parity claims without evidence.

## N04 · P1 · Production optimizer and contest integrations

**When:** Following session, after N02–N03. **State:** Prototype only.

- Replace bounded enumeration with an audited scalable solver when needed; version each operator’s exact roster and scoring rules.
- Add explicit group and bring-back rules, minimum exposure feasibility and portfolio simulation.
- Verify locked slots, canceled / early-start games, ties, rounding, CSV formats and operator permissions without automatic contest submission.

**Acceptance:** Independent solver oracle tests, feasibility reports and operator-rule fixtures. Any legal clearance remains separate from solver correctness.

## N05 · P1 · Ownership and props only with suitable targets

**When:** Following session. **State:** Blocked on labels and market rights.

- License contest-specific ownership labels; fit bounded / calibrated predictions without treating vendor projections as truth.
- Archive authorized lines at decision time; model pushes, voids, fees and correlated multi-leg payouts.
- Keep raw projection gaps, probabilities and monetary EV as separate displayed quantities.

**Acceptance:** Time-split calibration reports with explicit populations, sample sizes and entitlement checks.

## N06 · P2 · Expand coverage and operational delivery

**When:** Later, after a successful pilot. **State:** Not started.

- Validate each sport separately; do not assume NFL quality transfers to NBA, MLB, college sports or esports.
- Add a backend, server-side secret manager, status monitoring and an incident / stale-data publication policy.
- Revisit public feature descriptions only under a permitted review process; preserve dates and unresolved discrepancies.

**Acceptance:** Rights-approved coverage matrix and measured reliability targets, not a blanket “all sports / no manual work” promise.

## What not to assume

- The public inventory is not exhaustive coverage of authenticated screens.
- Unknown feature access is not synonymous with paid-only.
- No live feeds, real held-out sports evaluation, calibrated ownership/props, or LineStar-quality measurement is delivered.
- This project does not provide an IP/legal opinion. The four patent numbers are vendor-listed, not an independently verified freedom-to-operate analysis.
- No secret, subscription, user upload, or manual data input is required to run the delivered fixture prototype. Real-feed authorization and legal judgment cannot be automatically manufactured.
