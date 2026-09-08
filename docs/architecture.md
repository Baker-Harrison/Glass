# Architecture

- `desktop/main.mjs`: native window, menu, validated IPC, workspace metadata, and app lifecycle.
- `desktop/agent.mjs`: Pi sessions, provider runtime, mode restrictions, and custom browser/question/plan tools.
- `desktop/browser.mjs`: isolated WebContentsView tabs, navigation, screenshots, and browser records.
- `desktop/design-script.mjs`: selection overlay injected into the inspected page; no desktop IPC privileges.
- `desktop/files.mjs`, `project.mjs`, `terminal.mjs`: project operations, Git/search, and native PTYs.
- `src/main.jsx`: workspace shell and pane coordination. Smaller components handle conversations, questions, model selection, editor, terminals, plans, and review.
- `tests/`: local behavior tests with temporary fixtures.
- `vendor/pi`: pinned upstream source reference. Runtime uses exact npm versions.

The renderer accesses a narrow preload bridge. Main-process handlers accept only the app's main frame. Browser pages run in separate sandboxed views without that bridge. Model output and browser content are untrusted data.

Application data lives outside the repository. The stable `glass-agent` data directory is intentional so development and packaged builds share the user's existing sign-in. A single-instance lock prevents simultaneous writers.

Vite retains old hashed chunks because an open renderer may still lazy-load them. Packaging uses the built renderer and production dependencies. The generated logo source is `assets/glass.png`; the macOS icon is `assets/glass.icns`.
