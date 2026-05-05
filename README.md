# {PROJECT_NAME}

{PROJECT_DESCRIPTION}

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/)
- Node.js (see `.node-version`)

Linting and formatting use [Trunk](https://trunk.io/) (ESLint, Prettier, and more). The Trunk **launcher** is installed with project dependencies—you do not need a separate Trunk install for the default workflow.

### Installation

```bash
pnpm install
```

Optional: prefetch Trunk’s hermetic tools (helpful for offline work or CI images):

```bash
pnpm exec trunk install
```

If you prefer a global `trunk` on your PATH, see the [Trunk installation guide](https://docs.trunk.io/references/cli/getting-started/install) (e.g. `brew install trunk-io` on macOS).

### Development

```bash
pnpm dev
```

### Build, clean, and test

```bash
pnpm build
pnpm clean
pnpm test
```

Other commands (lint, format, knip, CI-style gates): [AGENTS.md — Quick commands](AGENTS.md#quick-commands).

## Linting & formatting

```bash
pnpm lint
pnpm format
```

## Maintenance factory (GitHub-native)

GitHub Projects–oriented control plane. Workspace packages: `@maintenance-factory/core`, `@maintenance-factory/github`, `@maintenance-factory/runtime`, `@maintenance-factory/service` (see rollout for responsibilities and field mapping).

- [docs/maintenance-factory-rollout.md](docs/maintenance-factory-rollout.md)
- [docs/end-user-guide.md](docs/end-user-guide.md) — operators, repo owners, and reviewers
- After `pnpm build`: `pnpm maintenance-factory -- <args>`

## Project structure

- `packages/`: workspace libraries and apps (see `pnpm-workspace.yaml`)
- `packages/common`: template shared utilities and types
- `packages/core`, `packages/github`, `packages/runtime`, `packages/service`: `@maintenance-factory/*` maintenance factory code

## License

{LICENSE}
