# Radar Design #59 — Cinematic Cockpit × Library

## Selected direction

- **Cockpit (concept 01):** Personal context first, daily-use shortcuts, observable PSN data.
- **Cinematic Library (concept 02):** Artwork-led feature area, larger cover-first browsing, dark navy premium visual language.
- **Mission Control (concept 03):** Only functional elements: platinum shortcut, explicit backlog and meaningful progress markers.
- No fabricated progression percentages or game-session analytics.

## Shared product structure

| Route | Character | Shared shell |
| --- | --- | --- |
| /radar | Editorial daily news magazine | Route-aware global navigation, spacing, tone and focus states |
| /xbox | Xbox Beta discovery, green accent | Same navigation and component rhythm; existing Xbox category sections |
| /ps-plus | PlayStation Plus catalog | Catalog filters and source context preserved |
| /preise | Price signals and history | Existing buy/watch/wait semantics untouched |
| /archive | Historic digital magazine covers | Editorial cover grid retained |
| /mein-playstation | Personal PSN Gameworld | Cinematic feature, real metrics, library-first exploration and Trophy Hunter |

## Implementation safeguards

1. Centralize shared navigation in `app/RadarTopNavigation.jsx` and the visual token layer in `app/radar-design-system.css`; specialized page styles remain in place.
2. Avoid presenting the root navigation on login, API or static daily-image routes. Existing authentication and data fetching are unchanged.
3. The Gameworld featured title is chosen from loaded PSN games; priorities, active platinum plans and favorites influence selection. The backdrop uses a verified metadata screenshot when present, otherwise falls back to the game's cover or gradient.
4. Display only descriptive values derived from PSN playtime or locally saved goals. No speculative trophy-progress ratio.
5. Existing Backlog, Planner, Trophy Gallery, cloud backup and tabs remain accessible. Progressive card rendering limits the initial large-library DOM footprint.
6. Respect reduced-motion preferences, mobile touch targets, keyboard focus and high-contrast text.

## Follow-on work

- **#60**: In-game collections, organizing manually planned games into the primary library, optional compact/list/cover views.
- **#61**: Trophy mission dashboard and better timeline statistics using actual snapshots.
- **#62**: Motion polish and real-device QA.

## Test boundaries

CI checks route navigation and overflow in Chromium and WebKit, but a live Sony-authenticated game account is not injected into CI. iPhone and live PSN content require separate validation.
