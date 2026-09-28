# Service discovery and maintenance

Each namespace models one upstream source. Start with the source's own API
documentation, then check a small read-only response before changing a typed
method. The raw `.call` catalog covers less-common RxNav, DailyMed, MeSH, and
PubMed operations; it does not imply every upstream response has a typed model.
The client does not infer equivalence between NDCs, RxCUIs, SPL set IDs, UNIIs,
UMLS CUIs, PMIDs, NCT IDs, and PubChem CIDs.

## Source map

| Service and implementation | Official reference and discovery route | Native result and paging | Live probe |
| --- | --- | --- | --- |
| [RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html), `src/rxnav.ts` | `findRxcuiByString` finds concepts by name; `findRxcuiById` accepts NDCs and other documented identifiers; inspect the individual operation's required keys | RxCUI lists and concept records in JSON; no paging in these typed lookups | Aspirin name → RxCUI 1191; RxCUI 198440 → NDCs |
| [Prescribable RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/PrescribableAPIs.html), `src/rxnav.ts` | Same family of search concepts but `/REST/Prescribe/` and a different dataset; do not substitute RxNorm results | JSON concept lists; no paging in the typed lookup | Acetaminophen tablet → RxCUI 198440 |
| [RxClass](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html), `src/rxnav.ts` | Search by class name, drug RxCUI, or class ID; `relaSource` and `rela` affect membership | JSON class concepts and drug members; check source-specific terminology rights | Class-name search for Analgesics |
| [RxTerms](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html), `src/rxnav.ts` | RxCUI → display information; not a general name search | JSON `rxtermsProperties` | RxCUI 198440 display term |
| [DailyMed services](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm), `src/dailymed.ts` | `spls` supports drug name, NDC, RxCUI, and UNII filters; label set ID leads to XML, NDCs, versions and downloads | JSON `data` + `metadata`; `page`/`pagesize` and `next_page`; SPL documents are XML | First aspirin label and its NDCs |
| [MeSH lookup/RDF](https://id.nlm.nih.gov/mesh/swagger/ui), `src/mesh.ts` | Descriptor label lookup, resource ID, or SPARQL; a descriptor is not an NDC | JSON lookup arrays/resources; SPARQL has its own query/format | Aspirin descriptor D001241 |
| [MedlinePlus Connect](https://medlineplus.gov/medlineplus-connect/web-service/), `src/medlineplus.ts` | RxCUI or NDC to drug-information links; also diagnosis, procedure, and lab codes | JSON feed links/titles, not drug monograph text | RxCUI 1191 link |
| [MedlinePlus health topics](https://medlineplus.gov/about/developers/webservices/), `src/medlineplus.ts` | English/Spanish keyword search via `db=healthTopics`/`healthTopicsSpanish` | XML `nlmSearchResult`; continuation needs returned `file` and `server` with `retstart` | Aspirin topic search |
| [MedlinePlus Genetics](https://medlineplus.gov/about/developers/geneticsdatafilesapi/), `src/medlineplus.ts` | `db=ghr` keyword search; condition/gene/chromosome/mtDNA JSON by slug | Different XML root, `search_results` with URLs/order/score; `file` + `server` for paging | Alzheimer search and condition JSON |
| [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/), `src/pubmed.ts` | ESearch term (including field tags and MeSH), ESummary PMID, EFetch XML | JSON `esearchresult`; `retstart`/`retmax` or E-utilities history; XML fetch | Aspirin MeSH search and PMID summary |
| [UMLS REST](https://documentation.uts.nlm.nih.gov/rest/home.html), `src/umls.ts` | Search terms/CUIs, crosswalk source vocabulary IDs, read concepts/atoms; requires an API key and applicable licenses | JSON result envelopes; search capped at 200 with no service-side paging | Exact aspirin CUI C0004057, **only with** `UMLS_API_KEY` |
| [ClinicalTrials.gov v2](https://clinicaltrials.gov/data-api/api), `src/clinical-trials.ts` | Search condition, intervention, or term; retrieve a study by NCT ID | JSON studies; opaque `nextPageToken` | Aspirin intervention search and NCT lookup |
| [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest), `src/pubchem.ts` | Compound name → CID; CID → properties; PUG View sections for detailed content | JSON `IdentifierList`, `PropertyTable`, or PUG View records; CID describes a compound, not a drug package | Aspirin name → CID 2244 and molecular formula |

PubChem and ClinicalTrials.gov are separate public biomedical services, not
NLM drug-identifier databases. Treat drug names as searches, not validated
cross-source joins. Check the linked service terms and attribution requirements
before distribution; the README summarizes the known RxNav, MedlinePlus
Connect, and PubMed request limits. No rate limiter, cache, or retry is built in.

## Checks

```bash
npm test                    # deterministic fixture tests; no network
npm run test:coverage       # same tests, with minimum coverage thresholds
npm run test:live           # low-volume real GET probes; requires network
npm run check:services      # coverage, then live probes

# Optional UMLS probe; use your own key and keep it out of logs/source:
UMLS_API_KEY=... npm run test:live
```

`NCBI_EMAIL` can supply your own contact email for live PubMed requests. The
live suite is deliberately opt-in and serial; it runs 18 read-only probes
across 12 source surfaces without UMLS (19 across 13 with it). Some probes make
two requests to follow a returned identifier. It does not test every catalog
operation. It does not run in CI because external availability, quotas, and a
licensed UMLS key are outside the repository's control. A successful probe
shows the sampled response is parseable today, not that every method or every
historic key works. Conversely, a failing live probe requires checking the
upstream response and service status before changing client behavior.

The deterministic suite covers routing, response parsing, identifier
directions, pagination, errors, and unusual formats. CI runs
`npm run test:coverage` against global minimums of **90% statements, 80%
branches, 90% functions, and 92% lines**; these are floors, not a claim of
complete API coverage. Inspect the per-file report for gaps when adding a
service. As of 2026-09-26, 41 deterministic tests measured 93% statements,
81.7% branches, 96.39% functions, and 95.05% lines. The live suite is excluded
from this coverage measurement.

## Updating a service

1. Read the service's linked reference, including the exact operation page,
   formats, pagination, rate guidance, and access terms. Note which key space
   each request and response uses.
2. Capture one small **read-only** example response. Prefer stable, public
   queries. Keep keys and any sensitive or licensed data out of fixtures and
   diagnostics.
3. Add or update a fixture test for method/path/query, native response shape,
   empty or malformed results, and a page boundary if applicable. Validate
   external fields before promising a typed result; keep unsupported fields
   available in the raw response when appropriate.
4. Update the typed method or raw catalog, then run `npm run test:coverage` and
   the relevant low-volume live probe with `npm run test:live`. Document source
   changes here and update the README when the public interface changes.
5. Before release, run the full repository quality gates and review source
   service terms. Do not interpret a name match or shared terminology CUI as
   proof of clinical equivalence.
