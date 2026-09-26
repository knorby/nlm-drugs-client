# ADR-0001: Source-facing operations and explicit key routes

- **Status:** Accepted
- **Date:** 2026-09-26

## Context

NLM's drug, label, terminology, consumer-information, and literature services
have different identifiers, response schemas, formats, licensing conditions,
and release cadences. An NDC may identify a marketed product or package; an
RxCUI identifies an RxNorm concept; a DailyMed set ID identifies a label; a
UNII identifies a substance. A name lookup is not a unique identifier lookup.
Combining their records into one drug object would hide those differences and
make unsupported joins appear authoritative.

## Decision

Expose one namespace per upstream source with a typed operation-name catalog,
source-native parameter keys, and unmodified responses. Centralize fetch,
format detection, HTTP error handling, URL encoding, and cancellation in the
transport. Add small `identifiers` methods for documented one-request
directions; return the source response rather than silently joining records.
MedlinePlus Connect uses a discriminated input for its code systems. JSON is
typed as `unknown` until a future validated response model is introduced.

Keep this package independent of other clients. Do not install a default
cache, retry policy, pagination iterator, or cross-service aggregate; those
policies depend on caller needs and each source's access terms. The package
remains private until public distribution and licensing are reviewed.

## Alternatives considered

- A single normalized medication model would simplify one app's reads but
  conflate source identifiers, uncertainty, and incomplete records.
- Separate generated client packages per service would provide more narrowly
  modeled responses but add a maintenance and dependency burden before the
  source-facing interface is established.
- A completely generic URL builder would expose every endpoint but give up
  discoverable operation names, path validation, and key-direction helpers.

## Consequences

Callers can compose their own workflows from stable service namespaces and
explicit keys. They must narrow `unknown` JSON responses, handle pagination
and rate limits, and determine whether a mapping is clinically appropriate.
When adding an upstream operation, check its documented path, required keys,
format, and response behavior, and cover it with a routing test. A future
normalized interface, if needed, can be layered on top without changing the
source-facing one.
