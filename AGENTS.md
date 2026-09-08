# Working on Glass

Glass is an Electron/React macOS agent workspace using the Pi SDK and its OpenAI Codex provider. Read README.md and docs/architecture.md before making structural changes.

## Scope and behavior

- Follow the user's current request. Keep changes focused; preserve unrelated changes and local data.
- Match supplied interface references and verify dynamic states, not only static screenshots.
- Keep browser, terminal, files, and review panels beside the chat unless the user explicitly expands a panel.
- Exclude automations, plugins, MCP management, canvas, cloud agents, and external IDE launchers.
- Keep Update hidden unless an actual availability signal enables it.

## Implementation

- Renderer code belongs in src/. Electron, Pi, filesystem, browser, and PTY integration belong in desktop/.
- Keep contextIsolation and sandboxing enabled. Never expose Node or application IPC to arbitrary browser pages.
- Add IPC operations to the preload allowlist and validate them in the main process.
- Preserve Plan/Ask tool restrictions and interactive-question cancellation behavior.
- Do not read, print, commit, or copy credentials or private session data into the repository.
- Avoid replacing dirty buffers or allowing stale asynchronous results to switch the active file or chat.
- Use the pinned Pi packages. vendor/pi is an upstream reference submodule; update its revision deliberately and document the reason.

## Verification and review

- Run npm run check, npm test, and npm run build for a code change.
- Run relevant native UI checks for affected behavior and report what was actually observed.
- npm run verify:sdk requires local sign-in. Never add credentials to CI to make it pass.
- Use feat/…, fix/…, or docs/… branches and a focused PR. Explain the problem, final behavior, checks, and limitations.
- Do not claim complete visual parity from a build or a unit test alone.
- Do not overwrite a running Glass.app bundle during packaging. Quit it first, or use a separate output path.
- When making UI changes, make sure to include a before and after image below the text of the PR.

CLAUDE.md and GEMINI.md are symlinks to this file. Edit only AGENTS.md for shared agent guidance.
