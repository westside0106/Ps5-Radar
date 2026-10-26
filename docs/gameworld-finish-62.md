# Gameworld Finish #62 — Mobile polish and performance

## Scope
- Preserve cinematic #59 visuals, library views #60, platinum and chronology #61.
- Short, composited enter animations for the featured game, dashboard metrics and platinum missions; restrained hover affordances.
- Defer WebGL `TrophyModel` until the user selects **3D-Trophäe aktivieren**. Trophy rank buttons and numbers remain available before activation. The optional Trophy Gallery is still triggered independently.
- Use asynchronous image decoding for game covers and a high-priority request only for the visible featured screenshot, while keeping cover fallbacks.
- Fix Gameworld state initialization: dependency arrays no longer read `activeCollection` or `viewMode` before their corresponding `useState` declarations.
- Respect `prefers-reduced-motion: reduce` for CSS transitions, entrance animations, and explicit programmatic `scrollIntoView`.
- CSS is isolated in `finish-62.css` to avoid piling fixes into the large legacy stylesheet.

## Browser regression coverage
- Responsive Chromium and WebKit widths: 320, 375, 390, 430; Chromium also 768, 1280.
- Navigation focus/visibility, no horizontal overflow, private-route protection, game collection creation and persistence, platinum mission and chronology navigation.
- The trophy collection must show a static preview and **not** render its WebGL canvas before explicit activation.
- At 320px, a forced reduced-motion preference disables entrance animation.
- Record and reject uncaught Gameworld hydration/runtime errors.

## Important boundaries
- These are reproducible browser/CI checks, **not** a physical iPhone screenshot audit.
- No guaranteed Lighthouse score or quantified speed-up is claimed; real user metrics need a production browser performance capture after deployment.
- Sony API responses and personal PlayStation data are not supplied to CI.
