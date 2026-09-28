# @knorby/nlm-drugs-client

TypeScript client for the NLM drug APIs.

> **Status:** early development. The public API is not implemented yet —
> exports will be added in upcoming releases.

## Installation

```bash
npm install @knorby/nlm-drugs-client
```

## Usage

```ts
import { /* ... */ } from "@knorby/nlm-drugs-client";
```

The package ships dual ESM/CJS builds with TypeScript declarations.

## Requirements

- Node.js 22+ (developed and tested on Node 24; see `.nvmrc`).

## Development

```bash
nvm use            # or: fnm use
npm install        # prepare is blocked by .npmrc ignore-scripts
npx husky          # set up Husky hooks
pre-commit install # set up pre-commit hooks (hygiene + secret scanning)
```

| Command | What it does |
| --- | --- |
| `npm run build` | Build the package (tsup + tsc — dual ESM/CJS output with `.d.ts`/`.d.cts` declarations) |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (no emit) |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npx changeset` | Record a versioned change for the next release |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, commit
conventions, and release process.

## License

[Apache-2.0](LICENSE) © Kali Norby ([@knorby](https://github.com/knorby))
