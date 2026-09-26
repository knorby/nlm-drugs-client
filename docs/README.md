# docs/

Living documentation for design, architecture, and decisions.

## Structure

- `decisions/` — Architecture Decision Records (ADRs). Create a new markdown
  file per significant decision, using the template below.
- [`service-maintenance.md`](service-maintenance.md) — per-source discovery,
  response/pagination notes, live probes, and upkeep checks.

## ADR template

```markdown
# ADR-NNNN: <Title>

- **Status:** Proposed | Accepted | Superseded by ADR-MMMM | Deprecated
- **Date:** YYYY-MM-DD

## Context

Why is this decision needed? What forces are at play?

## Decision

What was decided?

## Consequences

What are the trade-offs, risks, and follow-up actions?
```

Number ADRs sequentially (`ADR-0001`, `ADR-0002`, ...). Keep each record concise
and factual; supersede accepted records when an established decision changes.
