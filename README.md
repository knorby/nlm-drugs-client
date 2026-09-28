# @knorby/nlm-drugs-client

A fully typed TypeScript client for the U.S. National Library of Medicine
(NLM) drug APIs — [RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html),
[Prescribable RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/PrescribableAPIs.html),
[RxTerms](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html),
[RxClass](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html),
[DailyMed](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm),
and [MedlinePlus Connect](https://medlineplus.gov/medlineplus-connect/web-service/) —
with dual ESM/CJS output, generated types, and zero runtime dependencies.

Works everywhere `fetch` does: Node.js, browsers, and React Native / Expo.

## Features

- **One client, every NLM drug API** — RxNorm, Prescribable RxNorm, RxTerms,
  RxClass, DailyMed v2, and MedlinePlus Connect behind a single interface.
- **Fully typed** — request parameters and response payloads are typed
  end-to-end; dual `.d.ts` / `.d.cts` declarations ship for ESM and CJS.
- **Universal** — no Node-only APIs; runs in Node.js ≥ 22, browsers, and
  React Native / Expo. Bring your own `fetch` for older runtimes or tests.
- **Zero dependencies** — nothing to install, nothing to audit.
- **Configurable endpoints** — point any API at a mirror or a self-hosted
  [RxNav-in-a-Box](https://lhncbc.nlm.nih.gov/RxNav/applications/RxNav-in-a-Box.html)
  instance.
- **Tree-shakeable** — import only the sub-clients you use.

## Installation

```bash
npm install @knorby/nlm-drugs-client
```

## Quick start

```ts
import { createNlmClient } from "@knorby/nlm-drugs-client";

const nlm = createNlmClient();

// Look up a drug by name and normalize it to an RxNorm concept
const { rxcui } = await nlm.rxnorm.findRxcuiByString({ name: "lipitor" });

// Get the National Drug Codes for that concept
const ndcs = await nlm.rxnorm.getNDCs({ rxcui });

// Fetch the current official FDA label (Structured Product Label)
const label = await nlm.dailymed.getSpls({ drugName: "Lipitor" });
```

No API key or authentication is required — every wrapped service is public.

## Supported APIs

| Sub-client | API | What it gives you |
| --- | --- | --- |
| `rxnorm` | [RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html) | Normalized names, approximate matching, concept properties, related concepts, NDCs, historical status, spelling suggestions |
| `prescribable` | [Prescribable RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/PrescribableAPIs.html) | The prescribable subset of RxNorm for clinical e-prescribing use |
| `rxterms` | [RxTerms API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html) | Prescriber-friendly drug names, strengths, and dosing terms |
| `rxclass` | [RxClass API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html) | Drug classifications (ATC, MED-RT, and more) and class members |
| `dailymed` | [DailyMed API v2](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm) | Official FDA-registered product labels (SPLs), versions, media, packaging, NDC/UNII/RxCUI indexes |
| `connect` | [MedlinePlus Connect](https://medlineplus.gov/medlineplus-connect/web-service/) | Consumer-friendly health information matched to RxNorm, NDC, ICD-10-CM, and SNOMED CT codes |

> The RxNav drug–drug Interaction API was discontinued by NLM in January 2024
> and is therefore not part of this client.

## Usage

### RxNorm

```ts
const nlm = createNlmClient();

// Fuzzy match free text against drug names and codes
const matches = await nlm.rxnorm.approximateTerm({ term: "lipitor", maxEntries: 5 });

// Everything known about a concept
const info = await nlm.rxnorm.getAllRelatedInfo({ rxcui: "153165" });

// Check whether a concept is active, quantified, or obsolete
const status = await nlm.rxnorm.getRxcuiHistoryStatus({ rxcui: "153165" });
```

### RxTerms

```ts
// Prescriber-oriented term for an RxNorm concept
const term = await nlm.rxterms.getRxTermsInfo({ rxcui: "153165" });
// term: { rxcui, name, rxtermDoseForm, strength, ... }
```

### RxClass

```ts
// Drug classes that an RxNorm concept belongs to
const classes = await nlm.rxclass.findClassByDrug({ rxcui: "153165" });

// All members of a class
const members = await nlm.rxclass.getClassMembers({ classId: "N0000175656" });
```

### DailyMed

```ts
// Search official FDA labels
const spls = await nlm.dailymed.getSpls({ drugName: "atorvastatin" });

// One label document by SET ID, with its version history and media
const label = await nlm.dailymed.getSpl({ setId: "f9e0997e-c466-4e2a-910d-d77b4b9f9a4a" });
const history = await nlm.dailymed.getSplHistory({ setId: "…" });

// Indexes across all of DailyMed
const drugNames = await nlm.dailymed.getDrugnames();
const uniis = await nlm.dailymed.getUniis();
```

### MedlinePlus Connect

```ts
// Consumer health information for a medication code
const result = await nlm.connect.connect({ codeSystem: "rxcui", code: "153165" });
// result: { url, topicTitle, informationLink, … } per matched topic
```

### CJS

```js
const { createNlmClient } = require("@knorby/nlm-drugs-client");
```

## Configuration

```ts
const nlm = createNlmClient({
  // Override any base URL — e.g. a local RxNav-in-a-Box instance
  rxnavBaseUrl: "https://my-rxnav-box.internal",
  dailymedBaseUrl: "https://dailymed.nlm.nih.gov/dailymed/services/v2",
  connectBaseUrl: "https://connect.medlineplus.gov/service",
  // Supply a custom fetch: polyfill, instrumented fetch, or test stub
  fetch: globalThis.fetch,
  // Per-request timeout in milliseconds
  timeout: 15_000,
});
```

Each sub-client is also usable standalone:

```ts
import { RxNormClient } from "@knorby/nlm-drugs-client";

const rxnorm = new RxNormClient();
```

## Errors and etiquette

All failures throw a typed `NlmApiError` carrying the HTTP status, the
request URL, and the response body. The NLM APIs are a free public
resource — this client applies conservative defaults (timeouts, no
automatic retries) so you can add backoff appropriate to your workload
rather than hammering shared infrastructure.

## Attribution

NLM requests that applications using its data include the following
statement:

> This product uses publicly available data from the U.S. National Library
> of Medicine (NLM), National Institutes of Health, Department of Health
> and Human Services; NLM is not responsible for the product and does not
> endorse or recommend this or any other product.

Data from these APIs is for informational purposes only and is not a
substitute for medical advice, diagnosis, or treatment.

## Requirements

- Node.js 22+ (developed and tested on Node 24; see `.nvmrc`), or any
  browser / React Native runtime with `fetch`.

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
