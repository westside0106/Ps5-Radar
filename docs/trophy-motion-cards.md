# Trophy Collector Studio — original motion card video export

## Functionality
An optional **ANIMIERTE VIDEO-KARTE EXPORTIEREN** button beside the existing SVG download generates an original 4-second trophy collector-card clip using browser canvas and MediaRecorder.

- Source data are the selected PSN trophy-set title, earned counters and progress. A 100% completed list is **not** automatically labeled platinum; only the platinum trophy counter confirms it.
- Original gradients, trident insignia, luminous grid, sweeping foil, animated sparkle particles and progress bar. No game cover, copyrighted illustration or external fonts.
- Output size 720×960 at up to 24fps; the encoding container is chosen from browser capabilities. Safari may create MP4; compatible Chromium browsers may produce WebM.
- The user initiates export; all drawing/recording happens inside the browser tab. The final downloadable Blob is never uploaded.
- If MediaRecorder/canvas recording is unsupported, the video control remains disabled with explanation and the original 1200×1600 SVG export still works.

## Boundaries
No guarantee all Safari/iOS versions support captureStream and MP4 recording. Encoder negotiation uses MediaRecorder.isTypeSupported; recording capability is detected on the client. A generated recording may fail due to device limitations. Do not present a simulated video download or convert to another codec behind the scenes.

## QA
- `scripts/test-psn-trophy-motion-card.mjs`: MIME negotiation, no fake platinum, bounded title line wrapping and output dimensions.
- `npm run test:psn`, Next.js production build, Chromium/WebKit mobile browser checks.
- Manual test with a real PSN Trophy List on iPhone 16 Pro for actual MP4 recording and Photos/Files save is recommended after release. Automated smoke tests verify control and unsupported fallback, but do not claim cross-browser encoded video validation.

## Security
No PSN tokens, login changes, third-party API calls or remote video generation. Generated filenames are alphanumeric-normalized and truncated. Object URL is revoked after a short delay. The local stream stops after completion or error.
