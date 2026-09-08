# Contributing to Glass

Small, focused pull requests are welcome. For a large change, open an issue describing the problem and expected behavior before investing in implementation.

1. Fork and clone the repository with submodules.
2. Install the requirements in the README and run `npm ci`.
3. Create a branch from current `main`: `git switch -c fix/descriptive-name`.
4. Make the change and run `npm run format`, `npm test`, and `npm run build`.
5. Exercise the affected flow in `npm start`. UI changes need a screenshot and an explanation of interaction checks.
6. Open a pull request describing the problem, resulting behavior, verification, and remaining limitations.

Keep unrelated edits out of a pull request. Preserve existing user files and dirty editor buffers. Do not include account data, credentials, personal paths, or private conversation screenshots. Tests should verify behavior, not duplicate implementation details.

CI checks formatting, builds the renderer, and runs local tests on macOS. It never needs a ChatGPT account. Reviewers should pay particular attention to IPC boundaries, browser isolation, filesystem confinement, streaming order, cancellation, and persistence.

`main` is the reviewed branch. Feature branches are deleted after merge. `develop` is an optional integration branch, not a requirement for small fixes. Prefer squash merging a focused pull request.
