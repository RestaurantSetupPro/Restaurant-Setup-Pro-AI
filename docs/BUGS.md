# Bug Log

## Open / Limitations

### Product image upload

Module 05 manages image type, URL, main selection, and approval status. Binary upload/object storage is not implemented. AI images are placeholders; no external AI API is called.

### Catalog-scale search

Combined search is capped at 500 results. Full-text/semantic indexing and pagination remain future scale work.

### PostgreSQL concurrency

The existing synchronous worker bridge is retained to avoid restructuring accepted modules and should be reviewed before high-concurrency use.

## Resolved

- Cloud listener uses platform `PORT` and `0.0.0.0`.
- Database startup exposes safe connection/migration diagnostics.
- Readiness recalculates after product, knowledge, and image changes.

## Template

Record date, environment, severity, reproduction, expected/actual result, non-secret logs, owner, and status.
