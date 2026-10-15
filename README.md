# VS Code Dev Toolkit

Shared development, demo, recording, packaging and publishing utilities for VS Code extensions.

## Package

- [@moyarich/vscode-dev-toolkit](packages/vscode-dev-toolkit/README.md) — extension development, isolated VS Code sessions, Playwright demos, GIFs, VSIX packaging and Open VSX publishing.

## Development

This repository uses npm workspaces. Publishable libraries live in `packages/*`; future applications belong in `apps/*`, with repository documentation in `docs/` and examples in `examples/`. Apps should consume shared docs and examples rather than own them.

See [development instructions](docs/development/README.md) for install, tests and package verification.
