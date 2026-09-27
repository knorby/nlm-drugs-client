# @knorby/nlm-drugs-client

A TypeScript client for drug, terminology, literature, health-topic, clinical
trial, and chemical information. It has typed methods for RxNorm, Prescribable
RxNorm, RxClass, RxTerms, DailyMed, MeSH, PubMed, MedlinePlus Connect,
MedlinePlus health topics and Genetics, UMLS, ClinicalTrials.gov, and PubChem.
The upstream operation catalog remains available through `.call` for less
common endpoints. An RxCUI, NDC, SPL set ID, UNII, UMLS CUI, PMID, NCT ID,
and PubChem CID are different key spaces; the client does not merge them.

The package is currently private (`private: true`) and is not published to npm.
Its ESM and CJS builds target Node.js 22+ and runtimes with standard `fetch`.
A React Native/Expo SDK 57 consumer is type-checked and bundled
for both iOS and Android in CI. This checks Metro/Hermes compatibility, not
on-device execution or connectivity to the upstream services.

## Important notice

This is an independent project. It is not affiliated with, sponsored by,
approved by, or endorsed by the U.S. National Library of Medicine (NLM), the
National Institutes of Health (NIH), the U.S. Department of Health and Human
Services, or the other upstream data providers.

This software retrieves information from third-party sources. It does **not**
provide medical advice, diagnosis, treatment recommendations, prescribing
guidance, or dosage instructions. Source data can be incomplete, outdated, or
inapplicable to a particular patient. Check the current original source and
consult a qualified clinician or pharmacist before making health decisions.

## Usage

```ts
import { NlmDrugsClient } from "@knorby/nlm-drugs-client";

const client = new NlmDrugsClient({
  // Optional: inject a compatible fetch for tests or a custom runtime.
  pubMed: { email: "researcher@example.org", tool: "my-research-app" },
});

// Typed, parsed methods with source-specific terminology and keys.
const rxCuis = await client.rxNorm.findConcepts("aspirin", { search: 2 });
const concept = await client.rxNorm.getConcept(rxCuis[0]!);
const labelPage = await client.dailyMed.searchSpls({ drugName: "aspirin", pageSize: 20 });
const classMatches = await client.rxClass.findClasses("Analgesics");
const articles = await client.pubMed.search("aspirin[MeSH Terms]", { pageSize: 10 });
const topics = await client.medlinePlus.searchTopics("aspirin");
const studies = await client.clinicalTrials.searchStudies({ intervention: "aspirin" });
const cids = await client.pubChem.findCompoundIds("aspirin");

// UMLS needs your own licensed API key; omit it if you do not use UMLS.
const umls = new NlmDrugsClient({ umls: { apiKey: process.env.UMLS_API_KEY! } });
const cuiMatches = await umls.umls.search("aspirin", { searchType: "exact" });

// Explicit directions between identifiers; results remain source responses.
const ndcs = await client.identifiers.ndcsForRxCui("198440");
const spls = await client.identifiers.splsForUnii("R16CO5Y76E");
const descriptor = await client.identifiers.meshDescriptorsForName("aspirin");

// Native escape hatch when no typed method is available yet.
const raw = await client.rxNorm.call("getRxcuiHistoryStatus", { rxcui: "198440" });
```

Typed methods parse documented response fields and throw `NlmResponseError`
when those fields have an unexpected shape. They return simple results, page
records, or async iterators rather than upstream JSON envelopes; additional
source fields remain available via `.call`. Each `call` takes a documented
operation name and the source's query keys.
Path variables (such as `rxcui` or `setid`) are removed from the query string;
remaining options pass through to the upstream endpoint. Required parameters
are checked before a request. Source JSON responses are `unknown` until
narrowed by your application; XML/text responses are strings. This preserves
upstream fields without claiming a stable schema where none is validated.

### Service surfaces

| Namespace | Coverage | Examples |
| --- | --- | --- |
| `rxNorm` | Concept and approximate search, NDC mapping; 36 raw operations | `findConcepts`, `approximateMatches`, `getNdcs` |
| `prescribable` | Prescribable concept and NDC lookup; 25 raw operations | `findConcepts`, `getConcept` |
| `rxClass` | Class name and membership search; 17 raw operations | `findClasses`, `getMembers` |
| `rxTerms` | Display terms; 4 raw operations | `getTerm` |
| `dailyMed` | Parsed SPL search, pagination, NDCs, XML; 12 raw resources and downloads | `searchSpls`, `iterateSpls` |
| `mesh` | Descriptor search, resources and SPARQL; 7 raw lookups | `findDescriptors`, `getResource` |
| `medlinePlusConnect` | Medication links, GET/POST for diagnoses, labs, procedures | `findDrugPages`, `connect` |
| `medlinePlus` / `medlinePlusGenetics` | Health-topic and genetics search plus JSON pages | `searchTopics`, `iterateTopics`, `getPage` |
| `pubMed` | Parsed search/summary, XML fetch and pagination; 9 raw E-utilities | `search`, `iterateIds`, `summarize` |
| `umls` | Authenticated UMLS search, crosswalk, concepts and atoms | `search`, `crosswalk`, `getConcept` |
| `clinicalTrials` | Study search, token pagination and NCT lookup | `searchStudies`, `iterateStudies`, `getStudy` |
| `pubChem` | Name-to-CID, CID properties and PUG View | `findCompoundIds`, `getProperties` |

`client.identifiers` routes NDC → RxCUI/SPL, RxCUI → NDC/SPL, SPL →
NDC/RxCUI, UNII → RxCUI/SPL, and name → RxCUI/SPL/MeSH descriptor. These
are independent lookups, not automatic joins; names may be ambiguous and
identifiers may have historical, product/package, or source-specific meanings.
For NDC status or history use `rxNorm.getNdcStatus(ndc)` or the raw
`getNDCStatus` operation rather than treating every mapping as current. For
downstream search not exposed by these services, use your own discovery layer
and pass the returned key here.

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
form data instead of a long URL. `NlmHttpError` reports upstream source and HTTP
status without including query strings or API keys. Pass `{ signal }` as the third
`call` argument (or the second convenience-method argument) for cancellation.

Pagination iterators cover DailyMed labels, PubMed IDs, MedlinePlus search,
and ClinicalTrials.gov studies. No default retries, cache, or rate limiter is
installed.
Callers must respect service-specific limits, cache guidance, access terms,
and licensing, especially for RxClass terminology. This library does not
replace a clinical review of source records.

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
enforced by the client. UMLS requires an API key and may require terminology
licenses; supply the key via `umls.apiKey`, not in source code. UMLS search is
limited to 200 results by the service, without server-side pagination. PubChem
records describe chemical compounds, not marketed drug packages.

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`).
- **npm** (bundled with Node).
- **pre-commit** — `pipx install pre-commit` or `brew install pre-commit`.
- **gitleaks** — `brew install gitleaks` (secret scanner for pre-commit).
- **Go toolchain** — `brew install go` (required once for the TruffleHog hook
  build).

The Expo compatibility fixture needs no local simulator; its separate lockfile
is installed by `npm run check:expo` when you run that check.

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
| `npm run typecheck:package` | Build and type-check the CommonJS package declarations from a consumer |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run offline tests with coverage thresholds |
| `npm run test:live` | Run opt-in, low-volume real-service probes |
| `npm run check:services` | Run coverage, then live service probes |
| `npm run check:expo` | Build and test an Expo SDK 57 consumer, then export iOS and Android Hermes bundles |

### Project structure

```
src/
  index.ts              # public client and typed namespace composition
  operations.ts         # upstream operation catalogs, transport, key routes
  parse.ts              # response parsing and shape errors
  rxnav.ts, dailymed.ts, mesh.ts, pubmed.ts, medlineplus.ts
  umls.ts, clinical-trials.ts, pubchem.ts
tests/
  client.test.ts         # source routing and identifier compatibility
  typed-clients.test.ts # typed methods, pagination, response validation
  live/                 # opt-in read-only service contract probes
examples/expo-compat/   # Expo SDK 57 consumer and native export check
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
- Tests and coverage floors (`npm run test:coverage`)
- Vulnerability scan (`npm audit --audit-level=moderate`)
- Expo SDK 57 consumer type-check and iOS/Android exports (`npm run check:expo`)

The default 41-test suite uses injected `fetch`, so it stays deterministic and
never depends on service availability. Current measured coverage (2026-09-26)
is **93% statements, 81.7% branches, 96.39% functions, and 95.05% lines**.
CI enforces minimums of 90%, 80%, 90%, and 92%, respectively. Coverage is a
code metric, not proof that every upstream endpoint has been tested.

Run `npm run test:live` when changing source mappings or checking for upstream
drift. It runs 18 read-only probes across 12 source surfaces, or 19 across 13
with `UMLS_API_KEY` set. Some probes make two requests to follow a source key.
Optionally set `NCBI_EMAIL` to your real contact email for the PubMed probe.
Live tests are intentionally separate from CI: upstream outages, quotas, and
UMLS licensing should not
block offline verification. `npm run check:services` runs coverage first and
then these probes. See [`docs/service-maintenance.md`](docs/service-maintenance.md)
for the per-service discovery sources, response formats, pagination notes, and
upkeep checklist.

`examples/expo-compat/` is a minimal React Native consumer. Its CI job builds
this package, installs the fixture's own lockfile, type-checks the consumer,
and exports iOS and Android Hermes bundles with Metro. It exercises both the
JSON-based RxNorm and XML-based MedlinePlus imports. It cannot establish that
requests work on a device: no simulator or device test is currently run.
Expo apps should never embed a UMLS API key (including via `EXPO_PUBLIC_`
variables); route authenticated UMLS calls through a trusted backend.
The fixture uses Expo's SDK-compatible React, React Native, and TypeScript
versions rather than newer registry releases; `expo install --check` verifies
their compatibility. Dependency audit findings for this development-only app
are documented in its [README](examples/expo-compat/README.md).

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
- [MedlinePlus health topics](https://medlineplus.gov/about/developers/webservices/)
  and [Genetics](https://medlineplus.gov/about/developers/geneticsdatafilesapi/)
- [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) for PubMed
- [UMLS REST](https://documentation.uts.nlm.nih.gov/rest/home.html)
- [ClinicalTrials.gov data API](https://clinicaltrials.gov/data-api/api)
- [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest)
- [RxNav terms](https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html)

The npm package name is already `@knorby/nlm-drugs-client`, but this package
is **not release-ready yet**: it is `private: true`, at version `0.0.0`, and
has no pending Changeset. The release workflow remains inactive in
`workflow-templates/release.yml`. Before publishing, review service terms,
make the package public, choose an initial version, complete the first manual
publish, and configure the npm trusted publisher and the GitHub `release`
environment before activating the workflow. Provenance for subsequent CI
publishes requires a public GitHub repository; npm's trusted-publisher setup
must also permit direct publishing for this workflow. See
[`AGENTS.md`](AGENTS.md) for the release checklist. The published-file
whitelist is `dist/`, `README.md`, `CHANGELOG.md`, and `LICENSE`; npm always
includes `package.json`.

## Documentation

- [`AGENTS.md`](AGENTS.md) — instructions and steering for AI coding agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow, commit
  conventions, publishing.
- [`docs/`](docs/) — design notes, architecture, and decision records.
- [`docs/decisions/ADR-0001-typed-source-clients.md`](docs/decisions/ADR-0001-typed-source-clients.md) — client design decision.

## License

[Apache-2.0](LICENSE) © Kali Norby ([@knorby](https://github.com/knorby))
