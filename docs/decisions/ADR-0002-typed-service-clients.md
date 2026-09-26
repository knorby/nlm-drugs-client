# ADR-0002: Typed service modules with a raw escape hatch

- **Status:** Accepted
- **Date:** 2026-09-26
- **Supersedes:** ADR-0001

## Context

An operation-name catalog maps documented endpoints but leaves consumers to
parse every JSON envelope, manage pagination, and learn each service's shape.
This is too shallow for normal client use. Drug and non-drug information also
exist across separate biomedical services, each with different identifiers and
terms. A single merged medication record would still conflate those keys.

## Decision

Provide service-specific typed methods and response models in separate source
modules, composed by `NlmDrugsClient`. Validate external responses at each
method's return boundary. Provide paginated async iterators where the service
supports pagination. Preserve the upstream operation catalog as `.call` for
less-common RxNav, DailyMed, MeSH, and PubMed endpoints. Continue to expose
documented key directions explicitly without an automatic aggregate.

Add MedlinePlus health topics and Genetics, UMLS REST (caller-supplied key),
ClinicalTrials.gov v2, and PubChem PUG endpoints as dedicated modules. Parse
MedlinePlus search XML with `fast-xml-parser`; do not parse markup with regex.
Keep requests on fixed service origins and avoid credentials in error messages.
Do not add a global cache, retry, or rate policy across services with different
usage limits. The package stays private pending service-terms review.

## Alternatives considered

- Keep only the catalog: low maintenance, but pushes response validation and
  service conventions onto every caller.
- Generate a complete method for every endpoint: broad coverage but a large,
  hard-to-review interface and no guarantee of useful response modeling.
- Merge records by drug name: convenient for one use case, but names and
  identifiers do not guarantee equivalent substances, products, and labels.

## Consequences

Typed methods make common discovery and lookup workflows ergonomic; callers
can still access unmodeled upstream operations. Source-specific shapes and
identifiers stay visible. Tests must cover parsing and pagination as well as
routing. Callers retain responsibility for access terms, rate limits,
licensing, and interpretation of biomedical results.
