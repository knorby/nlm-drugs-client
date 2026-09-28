# ADR-0001: Typed source clients with explicit key routes

- **Status:** Accepted
- **Date:** 2026-09-26

## Context

Drug, label, terminology, literature, consumer-health, clinical-trial, and
chemical-information services have different identifiers, response schemas,
formats, licensing conditions, and release cadences. An NDC identifies a
marketed product or package; an RxCUI identifies an RxNorm concept; a DailyMed
set ID identifies a label; a UNII identifies a substance. UMLS CUIs, PMIDs,
NCT IDs, and PubChem CIDs are also distinct keys. Names are not unique keys.
Combining records into one drug object would hide differences and make
unsupported joins appear authoritative. Conversely, only exposing a generic
operation catalog leaves every caller to parse JSON envelopes and paginate.

## Decision

Provide source-specific typed methods and validated response models in separate
modules, composed by `NlmDrugsClient`. Add paginated async iterators where the
service supports pagination. Keep the upstream operation-name catalogs under
`.call` for less-common RxNav, DailyMed, MeSH, and PubMed endpoints; raw JSON
stays `unknown`. Centralize fetch, format detection, safe HTTP errors, URL
encoding, and cancellation in the transport. Keep explicit `identifiers`
methods for documented one-request key directions without automatically
joining records. MedlinePlus Connect uses discriminated code-system inputs.

Support MedlinePlus health topics and Genetics, UMLS REST with a caller-supplied
key, ClinicalTrials.gov v2, and PubChem PUG as dedicated modules. Parse
MedlinePlus search XML with `fast-xml-parser`, not regex. Keep requests on fixed
service origins and credentials out of error messages. Remain independent of
other clients and private until public distribution and service terms are
reviewed. There is no global cache, retry policy, rate limiter, or cross-service
aggregate; access rules and clinical interpretation remain caller concerns.

## Alternatives considered

- A single normalized medication model would simplify one app's reads but
  conflate source identifiers, uncertainty, and incomplete records.
- A generic URL builder or operation catalog alone would cover routes but push
  validation, envelopes, pagination, and service conventions onto every caller.
- Generating a method for every endpoint would create a large, hard-to-review
  interface without guaranteeing useful response modeling.

## Consequences

Typed methods make common discovery and lookup workflows ergonomic; callers
can still access less-common operations and unmodeled source fields through
`.call`. Typed methods validate upstream response fields before returning.
Source-specific identifiers and shapes remain visible. Add tests for parsing,
pagination, errors, and routing alongside a low-volume live probe per service;
see [`../service-maintenance.md`](../service-maintenance.md). Callers retain
responsibility for access terms, rate limits, licensing, and interpretation of
biomedical results. A future normalized interface could be layered on top
without changing the source-facing one.
