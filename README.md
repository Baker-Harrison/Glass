<p align="center"><img src="assets/glass.png" width="120" alt="Glass icon"></p>

# Glass

An independent, local macOS agent workspace powered by [Pi](https://github.com/earendil-works/pi). Chat, inspect a website, edit files, review changes, and run terminals in one window.

Glass uses Pi's OpenAI Codex provider for ChatGPT sign-in. Credentials remain in the main process and are stored outside the project. Glass is not affiliated with Cursor or OpenAI.

**Status:** early development. Core workflows work, but visual refinement and interaction verification are ongoing. The local app is not notarized.

## Run

Requirements: macOS 13+, Node.js 22+, npm, Git, and [ripgrep](https://github.com/BurntSushi/ripgrep) (`brew install ripgrep`).

```sh
git clone --recurse-submodules https://github.com/Baker-Harrison/Glass.git
cd Glass
npm ci
npm run build
npm start
```

Open Settings and choose **Sign in with ChatGPT**. Complete the provider's browser flow. Available models depend on your account. No API key is required for this provider.

## Features

- Streamed agent conversations with thinking, tool results, cancellation, and queued follow-ups.
- Agent, Plan, and Ask modes; interactive questions pause the agent for your response.
- Browser tabs, navigation, Design Mode selections, screenshots, console and network records.
- File explorer, search, Monaco editor, native terminals, and Git change review.
- Split conversations and persistent conversation/editor state.

There are no cloud agents, automations, plugins, MCP management, canvas, or external IDE launcher.

## Development

```sh
npm test             # Local tests; no sign-in or inference
npm run check        # Formatting
npm run build        # Renderer production build
npm run package:mac  # release/Glass-darwin-<arch>/Glass.app
```

`npm run verify:sdk` is an optional local integration check requiring an existing Glass ChatGPT sign-in. It does not belong in unauthenticated CI. `npm run dev` starts only the renderer development server; `npm start` loads the built renderer in Electron.

See [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/architecture.md), and [AGENTS.md](AGENTS.md). Start from `main`, use a short-lived `feat/…` or `fix/…` branch, and open a pull request. `develop` is available for integration work; releases come from `main`.

## Local data and updates

On macOS, sessions and credentials live in `~/Library/Application Support/glass-agent/`. Never commit this directory, OAuth callbacks, tokens, or personal conversation exports. Projects remain on your filesystem.

The Update button is hidden by default via `features.updateAvailable` in `src/app-config.js`. An actual updater is not integrated yet.

## Feedback

[Report a bug or request a feature](https://github.com/Baker-Harrison/Glass/issues/new/choose). For security issues, follow [SECURITY.md](SECURITY.md).

## License

MIT. Pi and other dependencies retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
