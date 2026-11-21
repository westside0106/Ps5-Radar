# Trophy Guide Hub — personal, source-aware guides

This feature intentionally does not scrape, copy, or rehost content from guide websites. The PSN trophy-list key `npCommunicationId` is the only identity used for the local record, avoiding unreliable name-based mapping between PS4/PS5 editions.

## UI
- Embedded within the existing per-game trophy sheet, without a second Sony API call.
- Curated search shortcuts open a general web search limited to PSNProfiles, PowerPyx, TrueTrophies, or PlayStationTrophies. These are **searches**, not claims that a matching guide exists.
- Paste a *user-confirmed* HTTPS guide URL from an allowlist, select the missable-trophy status, add a personal 400-character note.
- Private localStorage, optional cloud sync through existing versioned profile backup, and portable JSON backup. No new authentication or server-side scraping.

## Security and data ownership
- Only `https:` with known guide/video hosts, no URL userinfo, nonstandard ports, or untrusted hosts.
- `normalizeTrophyGuides` bounds the number and size of all saved entries, and backups never trust raw URLs.
- On import or cloud restore, conflicting entries resolve by `updatedAt` and do not silently overwrite newer local notes.
- Opening external search results may reveal a search phrase to the external search provider. No tracking or automatic connections are initiated by rendering this component.

## QA and release gate
- `npm run test:psn` includes `scripts/test-psn-trophy-guides.mjs`.
- `npm run build` to verify integration into the Next.js client-side game modal.
- Browser check on Mobile Safari and Chromium: modal scroll, keyboard focus, URL validation, local save/delete, backup round-trip.
- This feature branch was based on `main` after RADAR ASCEND; unrelated PR #81 (Order History) should be rebased if it lands first.

## Not yet implemented
No automated guide discovery, guide content reproduction, provider difficulty estimates, missed trophy detection, or PSN account activity monitoring. Do not present user-entered missable status as automatically confirmed by an external provider.
