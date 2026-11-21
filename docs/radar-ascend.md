# RADAR ASCEND — PlayStation Command Center

Version: initial unified release candidate (November 2026). Everything described here is implemented in branch `feature/radar-ascend-command-center`, not necessarily deployed.

## Experience

- **CommandDeck:** `app/mein-playstation/CommandDeck.jsx` + CSS module. Renders cover-based latest-known title, cumulative PSN playtime, earned trophy totals and personally tagged games. Buttons open the *existing* planner / stats fold rather than parallel stateful modules.
- **AdvancedStats:** `lib/psn-advanced-stats.mjs` + visual components. No invented daily sessions; median and genre groupings use only known PSN values. A game with multiple genres contributes to each genre's playtime. Missing values show unknown instead of zero.
- **TrophyCardStudio:** Original collector art with three theme finishes, one-to-one PSN trophy-set IDs, explicit platinum unlock validation and local SVG export at 1200×1600. No third-party copyrighted game cover embedded; no external calls or automatic uploads. No online sharing feature.
- **PS Plus Fristen-Radar:** `lib/ps-plus-deadline-plan.mjs`. Essential monthly *claim* deadlines and Extra/Premium *catalog departures* are separate; an unknown catalog departure is not "no departures". Stale/unverified source timestamps block departure claims.
- **PS Plus freshness repair:** `lib/ps-plus-monthly-selection.mjs` prevents old valid-looking articles from replacing a newer monthly edition. A missing new window clears the prior window text instead of recycling it.

## Data sources / integrity

| Data | Source | Caveat |
| --- | --- | --- |
| Cumulative gameplay | PlayStation profile | NOT observed sessions |
| Latest game activity | Last PSN-played timestamp | NOT a sequence of sessions |
| Earned trophies and platinum | PSN trophy sets | 100% ≠ platinum |
| Genre labels | Existing IGDB/PSN metadata | Multi-genre overlap; do not sum across genres |
| Essential claim end | Dated official monthly PS Plus article | Claiming is not catalog removal |
| Extra/Premium leaving dates | Verified catalog timestamps, when available | Current snapshot has no verified leavingAt values |
| Completion time | Future verified IGDB estimate | Not implemented in deadline decision model |

No additional PSN authorization or Sony token access is introduced by this release.

## QA / deployment gate

1. Review `#80` at the exact candidate SHA; review code paths and ensure no secrets or user data are in the diff.
2. Pass `npm run test:psn` and `npm run build` on GitHub Actions.
3. Pass mobile smoke tests at 320, 375, 390, 430px in Chromium/WebKit, including navigation, no horizontal overflow, private route access, and new collector UI. The smoke suite emits **synthetic-data screenshots**, not real PSN account content, under `artifacts/gameworld-qa/`.
4. Review screenshots of `ascend-deck` and `collector-card` from the CI artifact; check text truncation, keyboard navigation, 320px overflow, and high zoom/large font behavior.
5. Only merge the unified PR after the combined CI succeeds; prior separate drafts #77–79 are superseded by #80.
6. Verify production deployment associated with the actual merged SHA and check private routes. The Vercel project may need to be checked manually if no Vercel account is connected to the current tooling.
7. Check scheduled daily radar flow separately after merge. The existing scheduler intentionally resets to `main`; a run on a PR branch does not prove the production source refresh works.

## Rollback

The feature is additive: revert the single merge/squash commit for the unified PR to restore the original dashboard and PS Plus panels. Existing localStorage and Supabase keys were not renamed or removed. No database migrations are needed.

## Follow-up

Integrate a source-safe Extra/Premium leaving-date feed and verified IGDB duration estimates. Only after those exist, compute a personal "can I complete it before removal" recommendation. `psn_monitor`, order-history import, trophy guides, and animated cards remain separate future integrations; this release does **not** claim they are complete.
