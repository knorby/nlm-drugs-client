# @knorby/nlm-drugs-client

A TypeScript client for National Library of Medicine drug and health information
services. It exposes source-facing operations for RxNorm, Prescribable RxNorm,
RxClass, RxTerms, DailyMed, MeSH, MedlinePlus Connect, and PubMed E-utilities.
It also provides explicit identifier routes for NDC, RxCUI, DailyMed SPL set ID,
UNII, and drug names. It does **not** create a combined drug record or infer
that an ingredient and a marketed package are the same entity.

The package is currently private (`private: true`) and is not published to npm.
Its ESM and CJS builds target Node.js 22+ and other runtimes with `fetch`.

## Usage

```ts
import { NlmDrugsClient } from "@knorby/nlm-drugs-client";

const client = new NlmDrugsClient({
  // Optional: inject a compatible fetch for tests or a custom runtime.
  pubMed: { email: "researcher@example.org", tool: "my-research-app" },
});

// Source-native operations keep source-native request and response shapes.
const rxNormMatch = await client.rxNorm.call("findRxcuiById", {
  idtype: "NDC", id: "00310-0751-39",
});
const labelMatches = await client.dailyMed.call("spls", {
  ndc: "00310-0751-39", page: 1,
});

// Explicit directions between identifiers; results remain source responses.
const ndcs = await client.identifiers.ndcsForRxCui("198440");
const spls = await client.identifiers.splsForUnii("R16CO5Y76E");
const descriptor = await client.identifiers.meshDescriptorsForName("aspirin");

// Other services have dedicated namespaces.
const articleIds = await client.pubMed.call("esearch", {
  term: "aspirin[MeSH Terms]", retmax: 5,
});
const links = await client.medlinePlusConnect.drug({
  kind: "rxcui", code: "198440", language: "en",
});
```

Each `call` takes a documented operation name and the source's query keys.
Path variables (such as `rxcui` or `setid`) are removed from the query string;
remaining options pass through to the upstream endpoint. Required parameters
are checked before a request. Source JSON responses are `unknown` until
narrowed by your application; XML/text responses are strings. This preserves
upstream fields without claiming a stable schema where none is validated.

### Service surfaces

| Namespace | Coverage | Examples |
| --- | --- | --- |
| `rxNorm` | 36 RxNorm operations | `findRxcuiById`, `getNDCStatus`, `getNDCs` |
| `prescribable` | 25 Prescribable RxNorm operations | `findRxcuiByString`, `getDrugs` |
| `rxClass` | 17 drug-class operations | `getClassByRxNormDrugId`, `getClassMembers` |
| `rxTerms` | 4 RxTerms operations | `getAllRxTermInfo` |
| `dailyMed` | 12 v2 resources, plus latest PDF/ZIP and historical ZIP | `spls`, `splNdcs`, `splDocument`, `download` |
| `mesh` | 7 lookup endpoints, SPARQL, and resource JSON | `descriptor`, `sparql`, `resource` |
| `medlinePlusConnect` | GET and POST for medications, diagnoses, labs, and procedures | `drug`, `connect` |
| `pubMed` | 9 E-utilities with PubMed as the default database | `esearch`, `efetch`, `elink` |

`client.identifiers` routes NDC → RxCUI/SPL, RxCUI → NDC/SPL, SPL →
NDC/RxCUI, UNII → RxCUI/SPL, and name → RxCUI/SPL/MeSH descriptor. These
are independent lookups, not automatic joins; names may be ambiguous and
identifiers may have historical, product/package, or source-specific meanings.
For NDC status or history use `rxNorm.call("getNDCStatus", { ndc })` rather
than treating every mapping as current. For downstream search not exposed by
these services, use your own discovery layer and pass the returned key here.

`dailyMed.call("splDocument", { setid })` returns XML text;
`dailyMed.download({ setid, format: "pdf" | "zip", version? })` returns an
`ArrayBuffer`. `mesh.resource("D001241")` retrieves resource JSON.
`medlinePlusConnect.connect(input, { method: "POST" })` sends form-encoded
parameters; GET is the default. Drug-name-only fallback is English only;
MedlinePlus Connect returns links and titles, **not** complete drug monographs.
`pubMed` accepts optional `apiKey`, `email`, and `tool` in the constructor;
E-utilities usually return JSON for `einfo`/`esearch`/`esummary` and XML/text
for other operations. For long ID lists, use
`pubMed.call("epost", { id: ["123", "456"] }, { method: "POST" })` to send
form data instead of a long URL. `NlmHttpError` reports upstream source and HTTP status
without including query strings or API keys. Pass `{ signal }` as the third
`call` argument (or the second convenience-method argument) for cancellation.

No default retries, cache, rate limiter, or pagination iterator is installed.
Callers must respect service-specific limits, cache guidance, access terms,
and licensing, especially for RxClass terminology. This library does not
provide medical advice; verify clinical information against source records.

RxNav asks applications using NLM data to include this statement:

> This product uses publicly available data from the U.S. National Library of
> Medicine (NLM), National Institutes of Health, Department of Health and Human
> Services; NLM is not responsible for the product and does not endorse or
> recommend this or any other product.

The RxNav families share a limit of **20 requests/second/IP** and recommend
caching responses for 12–24 hours. Review the linked service terms before
redistributing terminology content, particularly SNOMED CT data from RxClass.
MedlinePlus Connect allows 100 requests/minute/IP; PubMed E-utilities permits
3 requests/second without an API key (10 with one). These limits are not
enforced by the client.

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`).
- **npm** (bundled with Node).
- **pre-commit** — `pipx install pre-commit` or `brew install pre-commit`.
- **gitleaks** — `brew install gitleaks` (secret scanner for pre-commit).
- **Go toolchain** — `brew install go` (required once for the TruffleHog hook
  build).

## Development setup

```bash
# Use the correct Node version
nvm use              # or: fnm use

# Install dependencies
npm install

# Set up hooks (prepare is blocked by .npmrc ignore-scripts)
npx husky
pre-commit install

# Verify all hooks
pre-commit run --all-files
```

The first `pre-commit run` installs all hook environments and builds
TruffleHog from source (a few minutes). Subsequent runs are cached and fast.

## Development

| Command | What it does |
| --- | --- |
| `npm run build` | Build the package (tsup + tsc — dual ESM/CJS output with `.d.ts`/`.d.cts` declarations) |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check source and tests with `tsc --noEmit` |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |

### Project structure

```
src/
  index.ts              # source operation catalogs, transport, identifier routes
tests/
  client.test.ts        # service routing and response behavior
dist/                   # build output (gitignored, generated by tsup)
.changeset/             # changeset files (versioning)
.github/workflows/      # CI workflows
workflow-templates/     # staged workflows (inactive until moved into .github/workflows/)
docs/decisions/          # architecture decision records (ADRs)
```

## Testing

Tests use [Vitest](https://vitest.dev/) and live in `tests/`. Add test files
as `*.test.ts`. The CI workflow (`.github/workflows/tests.yml`) runs the full
suite on every push to `main` and on PRs:

- Biome (lint + format check)
- TypeScript type-check (`tsc --noEmit`)
- Build (`tsup`)
- Tests (`vitest run`)
- Vulnerability scan (`npm audit --audit-level=moderate`)

A second workflow (`.github/workflows/pre-commit.yml`) runs the pre-commit
suite (file hygiene + secret scanning) with `SKIP=no-commit-to-branch`.

## Sources and release status

- [RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html),
  [Prescribable RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/PrescribableAPIs.html),
  [RxClass](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html), and
  [RxTerms](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html)
- [DailyMed web services](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm)
- [MeSH RDF](https://id.nlm.nih.gov/mesh/) and
  [MeSH lookup specification](https://id.nlm.nih.gov/mesh/swagger/ui)
- [MedlinePlus Connect](https://medlineplus.gov/medlineplus-connect/web-service/)
- [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) for PubMed
- [RxNav terms](https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html)

The package has not been released. Before a first public release, remove
`private: true`, verify service terms and package metadata, create a Changeset,
and follow the repository's staged release instructions in
[`AGENTS.md`](AGENTS.md). The published-file whitelist is `dist/`,
`README.md`, `CHANGELOG.md`, and `LICENSE`; npm always includes `package.json`.

## Documentation

- [`AGENTS.md`](AGENTS.md) — instructions and steering for AI coding agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow, commit
  conventions, publishing.
- [`docs/`](docs/) — design notes, architecture, and decision records.

## License

[Apache-2.0](LICENSE) © Kali Norby ([@knorby](https://github.com/knorby))
