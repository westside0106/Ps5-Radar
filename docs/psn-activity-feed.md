# Activity Feed – events only from observed PlayStation data

The RADAR ASCEND Activity Feed uses **two different, explicitly labeled PSN data sources**:

1. Cached unlocked trophy timestamps collected after manually opening individual trophy sets. The cache only stores `set`, `id` and `at`, not trophy names/types. Events are grouped by Berlin-local calendar day and PSN trophy-set ID.
2. Last-played timestamps for individual games from the existing PSN list. This is **one latest timestamp per title**, not the full history of sessions or game launches.

## Safety and integrity rules

- No new PSN API calls or continuous scraping, no PSN token changes, no external data provider or persistent event backend.
- Duplicate trophies and repeated game title IDs are counted once, invalid timestamps and dates more than five minutes in the future are excluded.
- Media apps are omitted from game events.
- Counts reflect **cached observations**, not Sony's total historic trophy count.
- Names for unknown trophy-set IDs are visibly identified as a trophy-set ID, not inferred from similar game names.
- Per-day trophy aggregates show the latest unlock time recorded on that day; no fabricated session boundaries or precise durations.
- Input is read only from the existing local browser trophy cache, PSN played list and trophy-set titles.
- Previously saved local trophies remain in the existing Cloud/JSON backup paths.

## User experience

The feed appears within the existing expandable **Gaming-Chronik & Statistiken** panel, immediately above the Advanced Stats. It uses a responsive neon-blue timeline with trophy and last-played events, source labels, filters and progressive loading.

## QA

- `node --test scripts/test-psn-activity-feed.mjs` validates timezone grouping, deduplication, missing timestamps, media exclusion, limited display and no simulated sessions.
- The standard `npm run test:psn` includes this test file.
- Chromium/WebKit smoke checks ensure the panel exists, filters work and synthetic-data screenshots are captured.
- Review the browser captures for 320/375/390/430 px, no horizontal overflow and keyboard accessibility.

## Follow-up

Detailed, continuous game sessions require an explicitly authorized activity-monitor service and may have limitations under Sony's terms; they must **not** be inferred from snapshot deltas. Animated collector cards and cross-title trophy milestones are separate future work.
