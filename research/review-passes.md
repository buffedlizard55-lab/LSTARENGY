# Three-pass implementation and verification record

Research observations: **2026-09-22 UTC**. This records actual implementation, findings and test results—not a guarantee of zero errors, legal clearance, or recovered proprietary methods.

## Pass 1 — implement and initially verify

**Completed: research inventory, original static site and executable independent prototype.**

- Inspected the original repository and its README/HTML claims. Classified substantive claims into 62 immutable-commit line ranges; presentation-only markup/CSS is not external factual evidence.
- Reviewed public vendor descriptions and primary/maintainer references. Recorded 30 dated sources with short excerpts, locators, links, limits and excerpt hashes. Source statements are attributed, not promoted to independent proof of accuracy.
- Built a 36-capability inventory, a 13-observed-label coverage plan, nine input categories, 14 review flags and six next-session work packages.
- Replaced universal “verified,” paid-only, free-data, latency, patent-safety and algorithm-recovery assurances with explicit evidence states and unresolved requirements. Preserved the web/App Store annual-price conflict and the advertised free historical Perfect Lineups view.
- Implemented a deterministic recency-weighted-mean baseline, historical quantiles, point-in-time filtering, fixture walk-forward evaluation, an exact small-pool single-lineup optimizer with a greedy portfolio, late-swap slot preservation, EV arithmetic and formula-safe CSV exports. Four fictional scenarios run without credentials, uploads or manual data entry.
- Built an original responsive research UI with search, filters, deep citations, downloadable data, server-rendered no-JavaScript content and worker-based computation. Added root and `docs/` Pages entrypoints because the existing configuration is `main:/` and changing it returned HTTP 403.
- Added test infrastructure and pinned, read-only GitHub workflows. No LineStar host or GitBook automated monitor is enabled.

**Initial checks:** 58 Node tests passed; evidence validation and the initial 21-asset deterministic build passed. The first complete browser run passed 16/18 tests and exposed real contrast, scroll-region focus and mobile select-name defects. Those defects were fixed rather than suppressed. Subsequent focused desktop/mobile accessibility scans passed; the complete expanded suite was rerun in Pass 2.

## Pass 2 — adversarial review and fixes

**Completed: implementation, source semantics, edge cases, usability and maintainability review.**

Findings fixed:

1. A manual lock could force an **unstarted OUT** player into a lineup. It now cannot; an already-started saved player still remains frozen in the original slot.
2. Finite inputs could overflow forecast, quantile, evaluation or optimizer arithmetic. These cases fail closed instead of publishing `Infinity`/`NaN`.
3. An exposure rounding epsilon could admit a player when a strict cap was just below 100% for one lineup. Caps now use the exact documented floor operation.
4. A greedy-prefix failure was described too strongly as portfolio infeasibility. Failure messages now explicitly **do not prove global infeasibility** and return no partial portfolio.
5. Close but unequal objective values were treated as ties. Strict objective comparison now preserves the better value, with a conservative numerical slack only for branch pruning.
6. Inherited object properties could be mistaken for slot locks. Lock lookup uses own properties; frozen-slot maps have null prototypes.
7. The generic evaluator incorrectly attached a synthetic provenance label regardless of caller data. Provenance is now attached by the fixture caller, not fabricated by generic mathematics.
8. Added as-of/model lineage to lineup CSVs; included access evidence and required inputs in the capability CSV. Both canonical and published model-card/handoff links now resolve.
9. Added fail-closed worker load errors and a ten-second computation deadline. Automated tests cover an unavailable and an unresponsive worker.
10. Compared the full base SHA with Git and inspected the original numbered claim ranges. Corrected the Statcast/client reference from the closing markup on line 167 to substantive line 166, after earlier methodology/pricing/build-plan/README range corrections. All 62 ranges now carry original-text hashes checked against the actual immutable Git object, not just SHA-shaped strings.
11. Corrected overbroad wording about the old paid-access assertions. Clarified publisher classes, unknown access boundaries, fixture-only quality metrics and lack of provider entitlements.
12. Executed the real availability CLI: **six allowlisted references returned network-level errors; 24 sources were intentionally skipped**. Preserved the raw attempt record separately from the public-text research observations. This is not evidence of six site outages. A newly added report link also triggered an accessibility regression; underlining fixed it.
13. Removed the unused legacy stylesheet, formatted human-edited source files, fixed the no-JavaScript test's configured base URL, and added full-history checkout for immutable-audit tests in CI.

**Pass 2 final results:** 70/70 Node tests, 22/22 desktop/mobile browser tests, 22 generated assets without drift, evidence validation, all four CLI scenarios, formatting and whitespace checks passed. The optimizer tests include **120 seeded small-pool comparisons against an independent exhaustive oracle**. Initial and fully expanded research states had no axe WCAG A/AA violations in the tested Chromium configurations. Desktop/mobile overview and lab screenshots were visually inspected.

## Pass 3 — original-request acceptance and final reliability review

**Completed: local research/code acceptance review and final release checks. GitHub delivery is separately tracked below.**

Rechecked the original request against the shipped files rather than treating a working homepage as completion of a production model. Additional fixes:

- Guarded derived value-ratio and freshness-limit arithmetic, and rejected American-odds conversion that loses the required decimal precision.
- Kept all-push probability arithmetic exact and avoided a tiny negative loss probability from subtraction order.
- Hid previous results while a new scenario is checking; rejected malformed worker results; ignored responses after worker termination. Added browser coverage for malformed output.
- Verified source links/anchors, source/access evidence separation, Markdown downloads, root/`docs`/project-prefix paths, no-JavaScript fallbacks, worker errors, stale-input export blocking and the explicit absence of live data.
- Release staging exposed CSV CRLF bytes and Markdown hard-break spaces as whitespace warnings. Added explicit CSV Git attributes that preserve the intended bytes; removed trailing Markdown spaces. The staged diff check was rerun.
- Rechecked the model card and next-session handoff for missing production gates, unauthorized-access assumptions, data-quality claims and misleading “complete replica” language.

### Acceptance matrix

| Original requirement                                          | Delivered result / honest boundary                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review line by line; link trusted evidence                    | 62 substantive legacy claim groups linked to exact original lines; 30 classified primary/maintainer sources with excerpt-level references. Uninspected legacy links are not certified. Hashes check integrity, not truth.                                       |
| Inventory features, strategies, inputs and paid functionality | 36 records with scope, dependencies, access evidence and implementation state. Six have documented Premium inclusion, one has a described free view, and 29 have unverified access boundaries. Public descriptions do not expose every authenticated screen.    |
| Independent implementation without manual input               | Shared build/browser/CLI baseline and optimizer run four complete fictional scenarios automatically. Twelve capability records have **prototype subsets**; 17 are planned and seven blocked—not 36 production features.                                         |
| Comparable production data quality                            | **Not established.** No authorized live dataset, commercial data contract, real held-out accuracy result, calibrated ownership/props target or comparable vendor benchmark was obtained. This remains an explicit project gate, not a silently assumed success. |
| Clean, organized GitHub Pages site                            | Responsive original UI, progressive controls, precise citations, exports and static-host-compatible assets. Tested at widths 320, 390, 768, 1024 and 1440 without page-level horizontal overflow.                                                               |
| Flag irregularities and recommend next steps                  | 14 visible review flags, corrected claim audit, dated availability report, model card and six prioritized work packages with acceptance criteria.                                                                                                               |
| Three cumulative passes                                       | This record distinguishes initial implementation, adversarial fixes, and request-level acceptance; tests were rerun after changes.                                                                                                                              |
| Create a PR, merge to main and verify delivery                | Release actions follow the local review. The authoritative merge state, CI outcomes and post-merge Pages verification are recorded on the delivery PR, not inferred from local tests.                                                                           |

### Final local checks actually executed

- `npm run build` — generated **22 deterministic assets**.
- `npm run check` — **72/72 Node tests**, 36/30/62 catalogue/source/audit validation, and zero generated-file drift.
- `npm run test:browser` — **24/24 tests** across desktop/mobile Chromium; initial and expanded axe A/AA scans passed. Automated accessibility checks are not a full accessibility certification or cross-browser guarantee.
- `npm run demo` — baseline and QB-stack each produced three lineups with 33,513 search nodes; late scratch produced one valid lineup with 22 nodes; the 48-hour snapshot was correctly blocked.
- `npm run format:check` and `git diff --check` — passed.
- `git fetch origin main` — upstream remained at the audited base before release; local work stayed on `arena/01a0cb4a-lstarengy`.

The sandbox's normal Playwright browser download failed. Local browser tests used a provisioned Chromium binary with its required libraries and normal sandbox/container flags; **browser web security was not disabled**. CI uses Playwright's standard Chromium installation instead.

## Delivery and remaining work

Local checks are complete; a “built” Pages setting alone does not prove that the new site is public. The [delivery PR and its verification comment](https://github.com/buffedlizard55-lab/LSTARENGY/pulls?q=is%3Apr+head%3Aarena%2F01a0cb4a-lstarengy) are the durable record of push, CI, merge and actual published-content checks performed after this review file was committed.

Next work is in the [handoff](../docs/data/next-session.md): rights/IP review; authorized point-in-time feeds and identity mapping; versioned operator scoring; real temporal evaluation/calibration; scalable contest-aware optimization; licensed ownership/market targets; backend/secret storage and measured operations. No source reachability result, unit-test count, synthetic metric or independent code implementation substitutes for those requirements.
