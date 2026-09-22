# Independent synthetic baseline — model card

- **Model:** `synthetic-recency-mean-v1`
- **Release scope:** executable software prototype, not a trained sports forecasting service.
- **Research snapshot:** 2026-09-22.
- **Data:** project-authored fictional teams, player labels, scores, salaries, and dates. No LineStar outputs, real athlete statistics, operator salaries, odds, or ownership observations are included.

## Intended use

Demonstrate a reproducible baseline, point-in-time filtering, a small exact lineup solver, safe CSV exports, and fail-closed quality gates without subscriptions, credentials, manual data entry, or external network calls. Running `npm run demo` produces all scenarios automatically. The website runs the same code in a worker.

This does **not** reproduce LineStar's model, establish freedom to operate, estimate gambling profitability, or establish accuracy parity. Publicly described proprietary methods are not implemented. Vendor data must not be used to train or benchmark this model without appropriate authorization.

## Input contract

- `schemaVersion`: 1; `dataKind`: `synthetic`; `source`: `project-authored-fixture`.
- Slate-level `asOf` (decision time) and `fetchedAt` (snapshot time).
- Player ID, fictional name, team, game ID, position, integer salary, explicit participation status, scheduled start and optional actual start.
- Historical event ID, event start, event end, first-available timestamp and fantasy points.
- Every timestamp must have an explicit timezone. Invalid dates, duplicate IDs/events, missing or non-finite points, invalid positions and unknown participation status are rejected.
- The fixture snapshot cannot be in the future or more than 24 hours old relative to the **simulated** decision time. This is a test threshold, not a production SLA or a statement of real-time freshness.
- Players in the same game must have consistent scheduled/actual starts.

## Mean baseline

For a decision time `t`, consider only events with `endAt < t` and `availableAt <= t`. Order them by event end and take the last six. Require at least three. For oldest-to-newest observations `x[0] ... x[n-1]`:

```
weight[i] = 0.8 ** (n - 1 - i)
mean = sum(weight[i] * x[i]) / sum(weight[i])
value = 1000 * mean / salary
```

Window, decay and minimum sample count are project design choices, not fitted hyperparameters. All arithmetic uses unrounded values; the UI rounds for readability. Non-finite intermediate arithmetic is rejected, even if the individual inputs were finite. An explicit `out` status produces a zero displayed mean and excludes the player from new roster additions. Missing or unknown status is not silently treated as active or as zero.

Historical P10/P90 use linear interpolation on the observed scores. They are **not calibrated predictive intervals**, not confidence bounds on the mean, and not a claimed future floor or ceiling. Injuries, opponent strength, changing role, weather, scoring systems and correlated player outcomes are not modeled.

The LineStar projection guide describes an expected median outcome [S04](https://linestar.gitbook.io/linestar-app/feature-guides/dfs-projections). Our mean baseline is deliberately a different, transparent specification.

## Research roster and optimization

The roster is our own explicit test specification, not a representation that DraftKings, FanDuel or Yahoo will accept the result:

- QB, RB, RB, WR, WR, WR, TE, FLEX (RB/WR/TE), DST.
- Salary at most 50,000, at least two teams, at most five players from one team.
- Every slot filled; unique player IDs; no fractional selections.
- Optional QB + same-team WR/TE constraint; explicit slot locks; player exclusions.
- Up to three lineups with a requested minimum number of different players between each pair.
- Optional maximum exposure uses `floor(requested lineup count × maximum fraction)` selections per player. If no full requested set can be built, return **no** partial portfolio.

Each lineup is solved with bounded exact enumeration / branch-and-bound, maximizing the sum of projected means. An upper bound that ignores uniqueness and a lower bound on remaining salary prune impossible branches. Interchangeable **unlocked** slots are canonicalized. Ties are deterministic. Different assignments of the same player set are not counted as diverse lineups.

Portfolios use sequential greedy selection of exact single-lineup optima. This is **not a globally optimal portfolio solver**; it can fail to complete a set even when a different first choice would make a full set feasible. A failure means the requested set was not produced by this procedure, not a proof of global infeasibility. Maximum 32 players, 12 rule-defined slots, three lineups and a shared node budget. A budget-exceeded exception never returns an unproven “optimal” result.

No expected-payout objective, ownership model, multi-entry simulation, group constraints, opponent bring-backs, minimum exposure or operator-compatible CSV templates are implemented. Use of independent standard methods does not constitute patent clearance.

## Late-swap behavior

At the simulated decision time, any existing player whose effective start is at or before that time is frozen in their **original slot**. Effective start is the earlier of scheduled and known actual start, if actual start is available. Started players not already in the saved lineup cannot be added. A frozen player cannot be excluded or moved to FLEX. A new out player cannot be selected. Frozen players stay frozen even if later marked out. A manually locked, unstarted OUT player is rejected too. The low-level solver trusts the caller-supplied saved-entry locks; it cannot independently establish that a roster was previously submitted to an operator.

This is a software constraint demonstration, not contest submission. Real operation needs approved operator rules, actual-start data, roster snapshots, deadline semantics, status timestamps and cancellation policy. No automated entries, browser automation against operators, or credential handling is present.

## Four automatic scenarios

1. **Baseline:** three distinct fixture lineups.
2. **QB stack:** three lineups satisfying the additional same-team pass-catcher rule. This constraint may already hold in the baseline; different output is not guaranteed.
3. **Late scratch:** an unstarted receiver from the prior best lineup becomes out at simulated 18:30 UTC. Previously started players remain in their exact slots; remaining slots are re-optimized.
4. **Stale feed:** a 48-hour-old snapshot fails the 24-hour test threshold. Forecasts/lineups are not displayed or exported for that run.

The scenarios are deterministic; their dates are not “today's slate.” They do not change on a rebuild.

## Walk-forward software evaluation

For each fictional player/event, use only earlier completed and available events at the target's start time. Skip decisions with fewer than three observations. Score forecasts against the held-out synthetic outcome. Report:

- MAE: mean absolute error.
- RMSE: root mean squared error.
- Unweighted historical-mean MAE on the **same** eligible rows.
- Number of evaluated player-events and the event IDs used for each forecast.

These values are tests of bookkeeping and mathematics on invented data. They do not support a claim about real predictive accuracy or expected return. They are not estimates from sports data, and they should not be compared to vendor performance.

For a real-data study, freeze time splits before tuning; preserve publication times and the historical state of corrections; version scoring rules; compare to naïve baselines on identical rows; report position/role slices, sample sizes and uncertainty; evaluate calibration separately from point error. Nonlinear fantasy bonuses must be scored per simulated outcome, not applied to a mean statistic as though expectation commuted with the bonus function.

## Prop arithmetic (not a prediction)

For decimal payout `d > 1`, unconditional win probability `pW` and push probability `pP`, where `pW + pP <= 1`:

```
pL = 1 - pW - pP
net EV per unit = pW * (d - 1) - pL
```

The website assumes `pW = 0.55`, `pP = 0`, `d = 1.91`, giving `0.0505` units. Those probabilities and odds are fictional inputs, not estimates or a market quote. A push is treated as stake returned. A void/refund with different settlement rules, exchange commission, fees, conditional promotions and correlated pick'em payouts require separate treatment.

The two-way no-vig helper normalizes inverse decimal odds for two mutually exclusive, exhaustive no-push outcomes. It does not establish a true win probability or work unmodified for a multiway/push market. American-odds conversion rejects invalid magnitudes.

## Reproducibility and security

- Shared pure JavaScript modules drive the build, CLI, browser worker and tests.
- No runtime dependencies, third-party browser requests, analytics, fonts or secrets.
- CSV cells are quoted and spreadsheet-formula prefixes are escaped. Exports identify `data_kind=synthetic` and use a project-specific schema, with as-of time and model/rule identifiers.
- The static build escapes catalogue text and validates all internal evidence references and excerpt hashes. A hash checks the **stored excerpt**, not the historical truth or authenticity of a complete source page.
- The browser terminates an unresponsive worker after ten seconds and blocks outputs/exports; reload or use the CLI to retry.
- Source observations are dated and remain separate from build and monitoring dates.
- External source monitoring is an availability signal only and explicitly excludes LineStar hosts. Failure does not overwrite the last reviewed evidence.

## Production gates

No real-data connector, licensing contract, ID crosswalk, current injury feed, official operator-rule implementation, live backend, real held-out evaluation, ownership labels, calibrated prop distribution, native app, notification service, or commercial legal review has been completed. See the [next-session handoff](../docs/data/next-session.md). Do not publish outputs as real forecasts until these gaps are addressed.
