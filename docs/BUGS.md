# Bug Log

## Open / Limitations

### Rule simulation only

Content analysis and generation are deterministic rules. Provider names are reserved adapters; no external AI API is called.

### Image tasks do not render images

Standard and Premium modes create priced task records only. Workers, queues, billing, object storage and generated media are future work.

### Source image metadata

The Factory requires a linked, non-rejected source media record. Binary upload/cloud storage remains outside the current implementation.

### Catalog scale

Product search remains capped at 500 results. The existing synchronous PostgreSQL worker bridge should be reviewed before high concurrency.

## Resolved

- Generated content cannot overwrite products before approval and Apply.
- Sales cannot view pending/rejected drafts or generate/review content.
- Product readiness recalculates after approved draft content is applied.
- Migration and Factory counters are visible in System Debug Center.

## Template

Record date, environment, severity, reproduction, expected/actual result, non-secret logs, owner and status.
