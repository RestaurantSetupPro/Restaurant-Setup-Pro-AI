# Workflow 1C Search Execution Foundation Report V1.0

## Business Goal

Workflow 1C establishes a controlled, auditable and resumable Search Execution foundation between an Approved Search Strategy and the existing Search Results. It does not call any real external search platform.

The implemented flow is:

`Approved Strategy -> Draft Search Task -> Admin/Owner Task Review -> Ready -> Execution Estimate -> Admin/Owner Approval -> Rules/Mock Connector -> Raw Payload -> Normalization -> Duplicate Detection -> Existing Search Results -> Existing Lead Pool`.

## Connector Contract and Registry

`src/services/search-execution.mjs` contains a code-owned allow-list registry and the shared contract: identity and capabilities, configuration validation, estimate, paged execution, normalization, evidence construction, error classification and safe log redaction. The registry contains exactly one enabled and approved connector: `rules-mock` version `1.0.0`.

Rules/Mock is deterministic, zero-cost, paginated, exposes stable external IDs and duplicates, and supports simulated timeout, 429, 500, invalid request, authentication, empty page and partial failure behavior. It uses the same contract intended for a future real connector. It cannot write Search Tasks, Search Results, Leads or Customers directly.

## Database

Migration `027_v53_search_execution_foundation.sql` adds `search_executions` and `search_result_raw_payloads`, bringing the SQLite business-table count from 77 to 79. `database/schema.sql` contains the matching SQLite definitions.

`search_results` is extended additively with execution, connector, external identity, canonical website, address, provider category, capture time, raw payload, normalization, deduplication and evidence references. Historical and manual rows do not require backfill. Existing `source_reference` remains supported.

Partial unique indexes prevent repeated external IDs and deterministic dedup keys inside the same Search Task. They do not impose global uniqueness across Tasks.

## Task and Execution State

Existing Task states remain Draft, Ready, Running, Paused and Completed. Only Admin or Owner can mark a Draft Ready, and the server rechecks the current Approved Strategy, approved connector, query, location and required fields.

Execution states are Draft, Awaiting Approval, Approved, Running, Paused, Completed, Partially Completed, Failed, Cancelled and Interrupted. Detailed phases are Estimating, Fetching, Normalizing, Deduplicating, Persisting and Finalizing. Stop causes are recorded separately rather than expanding permanent states.

At startup, an execution left Running is changed to Interrupted without deleting results. Resume reuses its immutable request snapshot, limits and checkpoint.

## Cost Approval

Rules/Mock estimated and actual costs are both zero, but estimation, persisted execution, Admin/Owner approval and audit remain mandatory. Search cost stays in `search_executions`; existing text/image AI budget semantics and provider billing remain unchanged.

## Pagination, Retry, Checkpoint and Resume

Server-enforced defaults are three pages, Task target quantity with a hard maximum of 100 results, two retries per page, 30-second request timeout metadata and 120-second execution duration. Each successful page persists raw payloads, normalized results, duplicate decisions, counters, checkpoint and heartbeat in a page transaction.

Retryable classifications are timeout, 429 and selected 5xx failures. Authentication, authorization, invalid request, schema and disabled/unapproved connector errors are terminal. Successful pages are retained after later failure. Stop becomes effective at a safe checkpoint.

## Raw Payload and Evidence

Raw provider-shaped records are stored before normalization in `search_result_raw_payloads`. Secret-like keys, API keys, authorization data, cookies and tokens are removed. Debug responses expose only aggregate health data, never full payloads.

Connector Results store connector/version, external ID, source URL, captured time, execution and provider request IDs, raw payload ID/hash, normalization version, field paths, original/normalized/rule-mapped fields and later manual modifications in `evidence_json`.

## Normalization and Duplicate Detection

Normalization v1 trims and Unicode-normalizes company names, canonicalizes websites and domains, validates lower-case email, keeps phone evidence, separates city/address, maps source category to internal types, treats external IDs as strings and records the capture-time source.

Within a Task, duplicate priority is external ID, canonical domain, normalized contact identity, then normalized company/location. Hard external-ID duplicates retain raw payload but do not insert a second formal Result. Other likely duplicates may be inserted with `duplicate_of_search_result_id` for review. Cross-Task history is retained and never globally merged.

No path automatically creates or merges a Customer. Existing human Convert to Customer remains the only conversion path.

## API

- `GET /api/search-connectors`
- `GET /api/search-tasks/:id/executions`
- `POST /api/search-tasks/:id/estimate-execution`
- `POST /api/search-tasks/:id/create-execution`
- `GET /api/search-executions/:id`
- `POST /api/search-executions/:id/approve`
- `POST /api/search-executions/:id/start`
- `POST /api/search-executions/:id/pause`
- `POST /api/search-executions/:id/resume`
- `POST /api/search-executions/:id/stop`
- `GET /api/search-executions/:id/results`
- `GET /api/search-executions/:id/debug-summary`

No dynamic connector registration, credential-writing, external-provider configuration, automatic Lead or automatic Customer API was added.

## Permissions

Admin and Owner can review/Ready, estimate, approve, start, pause, resume and stop. Sales can view and request estimates but cannot Ready or control execution. Existing Sales Result edit and manual Customer conversion capabilities remain. VA retains existing manual Result entry while execution control remains unavailable. Designer has no Search Execution access. Server endpoints return explicit 403 responses.

## UI

Opportunity Intelligence remains the host; no top-level navigation was added. “Start Search” was renamed “Mark Ready.” Search Task detail now shows connector/version, approval and execution state, phase, page/result/dedup/error counters, cost, checkpoint, heartbeat, stop reason and error summary. Actions are role/state aware, Stop uses risk styling, long checkpoint/error content is collapsible, and manual Result entry remains available. Connector results display a source badge.

Responsive rules keep the execution metrics and Task criteria within 1280px and 1440px layouts while preserving the existing dark-green visual system.

## Debug and Audit

Debug Center now includes safe connector metadata, execution status counts, stale/interrupted/partial counts, page/request/result/duplicate/error and cost aggregates, raw-payload orphans, missing Evidence and broken Result/Execution references.

Audit covers Ready gates and permissions, estimate, approval, start, page success/failure, retry, duplicate, normalization rejection, pause/resume/stop, interruption, partial completion, completion, failure and manual connector-result correction. Audit metadata is summary-only.

## Automated Tests and Manual Acceptance

Automated coverage validates migration 027 visibility, both new tables, the single approved registry connector, deterministic fixtures, retry classification, Approved Strategy gates, Admin/Owner Ready, zero-cost estimate, execution approval, blocked unapproved start, pagination, duplicate detection, Evidence/captured time, Search Results persistence, role restrictions and all existing module regressions.

The complete Node test suite passes. Syntax checks, health/readiness and Debug endpoints are part of final verification. Manual UI acceptance covers the Task review and execution flow plus 1280px/1440px layout.

## Known Limitations

- Execution is bounded and request-driven; Workflow 1C does not introduce a durable background queue.
- Pause/stop is checked at safe page boundaries.
- Rules/Mock fixtures prove the contract but are not real market data.
- Real-provider cost categories and credential management are intentionally deferred.

## Scope Confirmation

No Google Maps, Apollo, Yellow Pages, Website Search, social connector, CSV connector or web scraping was implemented. Google Maps belongs to a separately approved future phase. Workflow 1D has not started. Lead Qualification, Product Matching, CRM, Quote, PI, Production, Shipping and After Sales were not upgraded by Workflow 1C.
