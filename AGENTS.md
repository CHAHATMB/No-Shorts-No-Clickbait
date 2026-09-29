# Verification

- This is a vanilla JavaScript browser extension bundled with Webpack. `npm run build` builds both Chrome and Firefox into `dist/chrome` and `dist/firefox`.
- `npm run lint` runs the Firefox extension validator against `dist/firefox`; build first.
- Mascot browser regression tests need no extra dependencies. Serve the repository with `python3 -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/tests/mascot.html`. Results appear on the page and in `window.mascotTestResults`; every result should have `passed: true`.
- The browser tests exercise real DOM/CSS and PNG loading, with mocked extension APIs and timers. They do not replace testing the unpacked extension on YouTube.
- Test the mascot at desktop and narrow viewport sizes and with reduced motion enabled. Reload the extension and refresh existing YouTube tabs after rebuilding.
- `npm test` runs the dependency-free Node Test Lab regressions (message routing, production guards, transport errors, and saved-data changes).
- With the same local server, open `http://127.0.0.1:8765/tests/test-lab.html` for popup and in-page preview regressions. Wait for `window.testLabFinished`; every entry in `window.testLabResults` should have `passed: true`. Use a fresh browser context to avoid retained network mocks from earlier runs.
- `npm run build:dev` builds both browsers with the Test Lab enabled. Browser-level developer mode alone does not enable it in a production bundle. Build production before running release validation, then rebuild development if continuing to test the Test Lab.
