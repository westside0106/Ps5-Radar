# Radar Mobile & Catalog /goal — checkpoint

The implementation is isolated on feat/radar-mobile-catalog-goal. Production daily data, archives and PNGs are not included in the source patch. Do not merge before CI and mobile browser checks pass.

Scope: native responsive magazine, separate deal price/signal regions, identity-bound PS+ covers, /ps-plus with search, platform/genre/sort filters, pagination and detail sheets, independent public catalog refresh, explicit completeness/staleness reporting. Empty sections remain empty rather than being populated from guessed releases or other subscriptions. Trials and departures require independently confirmed entitlements/dates.

Commands: npm ci; npm run test:goal; npm run build; npm run catalog:refresh. The catalog refresh is independent and retains the last valid data on a failed source request. Its results are public-source observations, not proof of a personal subscription entitlement. The official Store remains the source of truth for purchases and availability.

Acceptance: correct title-bound artwork; no generic announcement image masquerading as a game cover; no price/signal overlap at 375/390/430/768/1280px; navigable catalog and details; source counts verified before claiming completeness; no false new-today labels; no modification to archive, daily PNGs, edition counter or price history by the catalog job; passing unit tests, build and browser tests. Merge and Vercel production release are separate steps.
