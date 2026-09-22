# LSTARENGY · Evidence-led sports projection research

[**Research website →**](https://buffedlizard55-lab.github.io/LSTARENGY/) · [Evidence register](research/catalogue.json) · [Original-claim audit](docs/data/legacy-audit.md) · [Model card](research/model-card.md) · [Next session](docs/data/next-session.md)

A dated review of **LineStar's public product descriptions**, an independent data/implementation plan, and a runnable **synthetic-data** projection prototype. This is **not** a recovered private algorithm, a subscription bypass, a production sports-data service, a legal clearance, or a demonstrated match to LineStar's data quality.

Research snapshot: **2026-09-22 UTC**. Build dates do not reset source observation dates.

## What is delivered

- **36 capability records**: public claim, exact evidence references, sport/screen scope, access status, independent implementation status, required inputs and limitations. “Premium documented” means included, not necessarily paid-only.
- **30 source records**: vendor / league / government / provider / platform / community-maintainer distinctions, successful public-text observation date, short excerpts, locations, links and excerpt hashes.
- **62 line-referenced legacy claim groups**: corrections against immutable base commit `0ac0b07a4c19105b6b952b3ef7943fd2a02bc56b`. Presentation-only HTML/CSS lines are not external factual claims.
- A **13-label coverage plan**, nine input categories, **14 review flags**, and six prioritized next-work packages with acceptance criteria.
- An original, responsive static site with search, category/evidence filtering, deep citations, JSON/CSV downloads and no-JavaScript research content.
- An independent, deterministic lab: recency-weighted mean forecasts, point-in-time filtering, historical quantiles, an exact small-pool lineup solver, locks/exclusions, optional QB stack, greedy multi-lineup diversity/exposure constraints, late-swap slot preservation, stale-data blocking and safe CSV export.
- Walk-forward **fixture** evaluation and EV arithmetic from **assumed**, not estimated, probabilities. All lab athlete labels, scores, salaries, odds and event dates are test fixtures.
- Automated unit/oracle tests, browser/accessibility tests, deterministic-build checks and policy-gated public-document availability monitoring.

## Important corrections to the old repository

1. **Perfect Lineups is not established as paid-only.** The vendor guide advertises a free historical view. Present archive limits were not tested. [Guide](https://linestar.gitbook.io/linestar-app/feature-guides/perfect-lineups)
2. **Annual offers differ.** The web pricing page displays $239.99/year; the US DraftKings app description displays $269.99/year. These are dated offers, not verified checkout totals or a universal price. [Web](https://www.linestarapp.com/Pricing) · [US app listing](https://apps.apple.com/us/app/linestar-for-dk-dfs/id933568931)
3. **The vendor describes expert intervention.** “Self-healing” is not evidence of a reproducible nightly retraining algorithm or a fully autonomous workflow. [Projection guide](https://linestar.gitbook.io/linestar-app/feature-guides/dfs-projections)
4. **An observed label is not a verified live feed.** Do not extend NFL/NBA tools across all sports or infer current CS2 coverage from a CSGO label. [Public navigation](https://www.linestarapp.com/)
5. **Legal and licensing barriers are real project gates.** The published terms restrict automated access, reverse engineering, use of outputs for AI/ML, and competitive use. No permission to ingest or redistribute LineStar outputs was obtained. The previous suggestion that standard algorithms are generally non-infringing has been removed. Patent ownership/scope/enforceability were not independently established. [Published terms](https://www.linestarapp.com/Terms-of-Use) · [Official patent-review route](https://www.uspto.gov/patents/search/patent-public-search)
6. A projection above a prop line is **not** sufficient to establish monetary EV. No ownership-based profit heuristic, guessed supplier identity, generic “free data parity,” or comparative latency guarantee is presented as fact.

## Run without manual data entry

Node.js **22+**, plus a Git checkout containing the audited base commit (normal full clone). The build, source validator, unit tests and demo have **no runtime package dependencies** and need no network or credentials.

```sh
npm run check       # tests + evidence integrity + generated-file drift
npm run demo        # automatically runs all four synthetic scenarios
npm run serve       # read-only static server on 0.0.0.0:4173
```

Open the displayed preview (or `http://localhost:4173` on your own computer). Browser application code uses only relative, same-origin URLs. `PORT` can change the local server port. Output under `artifacts/` is gitignored.

For browser/accessibility tests:

```sh
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run test:browser
```

If a Chromium binary is already installed, `CHROMIUM_PATH=/absolute/path/to/chromium npm run test:browser` uses it. `PREVIEW_URL` can target an already-running preview instead of starting the local test server. Do not disable browser security for tests.

## Editing and verification

Edit **source files**, not generated HTML or copied assets:

```text
research/catalogue.json       Curated claims, excerpts, flags, inputs, roadmap
research/legacy-audit.json    Original commit / line references and dispositions
research/model-card.md        Baseline, solver, assumptions and production gaps
research/review-passes.md     Actual three-pass review record
src/engine.mjs                Pure projection, validation, optimizer and EV math
src/demo.mjs                  Fictional fixtures and automatic scenarios
src/view.mjs                  Shared browser/build prototype rendering
src/catalogue.mjs             Traceability and excerpt-integrity validation
src/source-health.mjs         Bounded, allowlisted documentation checks
web/                         Original template, styles, client and worker
scripts/                     Build, validate, demo, server and availability CLI
tests/                       Unit, exhaustive-oracle and Playwright tests
index.html                   Generated root entrypoint for existing Pages config
docs/                        Generated Pages entrypoint, assets and downloads
.github/workflows/           Verify on PR/push; weekly documentation availability
```

After changes:

```sh
npm run build
npm run check
npm run test:browser
npm run format:check # optional formatting check; dev dependencies required
```

Every supported external capability claim must resolve to a source excerpt. Each access assertion requires its own evidence. Unknowns remain unknown. Excerpt SHA-256 hashes detect local edits; they are **not full-page captures, proof of authenticity, semantic verification, or proof that a vendor's claim is true**. No “zero hallucinations” guarantee is made. See the line-referenced audit and explicit review flags rather than a blanket verified label.

### Source monitoring

`npm run sources:check` writes `artifacts/source-health.json` and exits nonzero for availability problems. It is **not** a scraper or claim-verification system. It checks a small explicit public-document allowlist, follows at most three redirects, bounds response size and time, detects soft-error titles, and does not retry access denials.

The initial sandbox run returned network-level failures for six allowlisted references; 24 were deliberately skipped. The separately recorded [availability report](research/source-health.json) is not evidence that those six sites are down. Public-text review used a separate retrieval tool.

**LineStar hosts and its GitBook documentation are excluded from automated monitoring.** Their public-description observations remain dated; no account, protected endpoint, model output, network interception or paywall circumvention is used. Provider keys are not requested or stored. The weekly workflow preserves failure reports as artifacts without changing claims or pushing to a data branch.

## GitHub Pages

The existing Pages configuration was observed as **`main:/`**. The integration returned **HTTP 403** when asked to change it to `main:/docs`. The deterministic build therefore supplies **both root and `docs/` entrypoints**, with relative asset paths and `.nojekyll`. The existing root configuration can publish after merge without an administration change.

The GitHub workflow checks generated-file drift; it does not write to `main` or deploy an alternate branch. Existing branch-based Pages publishing performs deployment. A successful local test is not a claim that the public deployment has completed—check the PR, Pages build and [public URL](https://buffedlizard55-lab.github.io/LSTARENGY/).

## What remains before a real projection service

1. Dataset-specific rights review and qualified patent/terms review.
2. Authorized automated feeds for historical outcomes, operator slates/salaries, identities and current status, with measured freshness and corrections.
3. A point-in-time NFL pilot, versioned scoring (including nonlinear bonuses), real temporal holdouts, sample sizes, uncertainty and calibration—not synthetic error metrics.
4. Licensed contest ownership labels, market snapshots, payout/settlement rules and genuinely calibrated prop probabilities.
5. A scalable, audited optimizer and operator-rule tests; no claim that the greedy portfolio is globally optimal.
6. A backend / secret manager and operational monitoring for live data. Pages is static hosting, not a continuous sports-data service. [GitHub documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

These are listed with next-session priorities and acceptance criteria in the [handoff](docs/data/next-session.md). Autonomous operation cannot manufacture subscriptions, legal authorization, unknown proprietary methods, a current data feed, or evidence of model quality.

## Attribution and boundaries

Independent educational/analytical project. Not affiliated with LineStar, BetFully, sports leagues, DFS operators, or data providers. Names identify research subjects only; their logos, interfaces, proprietary datasets, outputs and algorithms are not copied. Short source excerpts are used for traceability and commentary, not as model training data. No warranties of accuracy, legality, profitability, future results, or freedom to operate.
