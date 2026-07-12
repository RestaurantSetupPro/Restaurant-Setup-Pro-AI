# Workflow 1B - AI Search Strategy & Human Approval Report V1.0

## Business Goal

Workflow 1B adds a separate, revisioned Search Strategy between Customer Discovery and Search Tasks. AI output remains advisory and Draft-only. Admin or Owner approval is required before a Draft Search Task can be created or marked Ready.

## Reused Modules

- Workflow 1A Active Company Knowledge and Target Customer Profiles
- Product Knowledge Engine read-only context
- Role-redacted Pricing Guidance
- Aggregated Existing Customer Learning
- AI Business Brain, AI Cost Control, context snapshots, execution logs and audit log
- Existing Customer Discovery, Opportunity Intelligence and Search Task workspace

## Database

Migration `026_v53_search_strategy_human_approval.sql` adds the only new business table, `search_strategies`. `database/schema.sql` contains the matching SQLite definition. The table stores one row per revision and enforces unique `(strategy_key, revision_no)` plus one Approved revision per strategy key.

The record contains structured strategy JSON, fixed Knowledge and Evidence references, generation metadata, planning cost estimates, context/execution/cost references, workflow actors, timestamps and an optional linked Search Task. No separate history or approval table was added.

## Data Contract

`strategy_data_json` is validated by the server. It includes target market, target customer profile, objective, product categories, keywords, platforms, source priority, positive signals, exclusions, result target, stop conditions, reasoning, warnings and confidence. Users edit a segmented form rather than raw JSON.

Product, supplier cost, pricing rules and full Customer records are referenced or aggregated; they are not copied into the Strategy.

## State Machine And Revision

The statuses are Draft, Needs Review, Approved, Superseded and Archived. Request Changes returns Needs Review to Draft with a review note and audit event. Approved records are immutable; editing creates a new Draft revision. The old Approved revision remains effective until the new revision is approved, then the change to Superseded and the new approval happen in one transaction.

## API

- `GET/POST /api/search-strategies`
- `GET/PUT /api/search-strategies/:id`
- `GET /api/search-strategies/:id/history`
- `GET /api/search-strategies/:id/context-preview`
- `POST /api/search-strategies/:id/generate`
- `POST /api/search-strategies/:id/estimate-search-cost`
- `POST /api/search-strategies/:id/submit-review`
- `POST /api/search-strategies/:id/approve`
- `POST /api/search-strategies/:id/request-changes`
- `POST /api/search-strategies/:id/archive`
- `POST /api/search-strategies/:id/create-search-task`

No Delete or Search Execution endpoint was added.

## Page Flow

Opportunity Intelligence now includes Search Strategies without adding a top-level navigation item. AI Discovery creates a Strategy Draft instead of a Search Task. The workspace supports blank Draft creation, segmented editing, AI generation, planning estimate, review, history and Approved-to-Draft-Task creation.

## Permissions And Redaction

Admin and Owner have full workflow access. Sales can create and edit owned Drafts, run AI and submit review, but cannot approve or create Search Tasks. VA can create and edit owned Drafts and submit review, but cannot run AI or approve. Designer has no Search Strategy access. Server-side checks return 403 for unauthorized workflow actions.

Sales and VA responses exclude full budget and provider configuration. Supplier Cost, Minimum Margin, provider secrets and API keys are never included.

## AI Context And Cost Control

AI generation requires both Active Company Knowledge and Active Target Customer Profile. Draft or Needs Review Knowledge is never used. Product references and aggregate Customer Learning are supplied through the existing context builder. The actual revision references, context snapshot, context hash, provider, model, prompt version and cost records are fixed on the generated Draft.

Generate and Regenerate run through AI Business Brain and AI Cost Control. Rules/mock runs retain zero-cost execution logs. Failed or blocked runs never create an Approved Strategy. Manual actions and Context Preview cost zero.

## Search Planning Estimate

The estimate uses selected platforms, locations, keyword groups and expected result count. It is labelled `planning`, shows its assumptions and records neither an actual external cost nor an external API charge. No connector is called.

## Search Task Gates

Direct `POST /api/search-tasks` now requires a current Approved Strategy and Admin/Owner authority. Strategy task creation creates only a Draft and records the relationship. `POST /api/search-tasks/:id/ready` rechecks that the linked Strategy remains Approved. Blocked bypass attempts are audited.

## Debug And Audit

Debug Center data includes Strategy totals and statuses, review and approval counts, unlinked Approved records, planning estimate totals, AI estimated/actual costs and blocked gate attempts. Audit events cover Draft creation/editing, AI success/failure, estimation, review transitions, approval, superseding, task creation and blocked gates.

## Tests And Acceptance

Automated coverage verifies migration/schema markers, structured JSON, Active-only context, revision references, Cost Control logs, planning estimates, role restrictions, 403 responses, review transitions, revision superseding, Search Task creation/Ready gates, zero Search Results and protected-module regressions.

Manual acceptance covers the twelve scenarios in the formal instruction using Admin/Owner/Sales/VA/Designer roles and the Opportunity Intelligence workspace.

## Known Limitations

- Rules/mock generation is the active safe provider; paid-provider adapters remain controlled by the existing AI foundation.
- Search execution costs are internal planning estimates, not supplier quotations.
- No external connector, scraping or search execution is included.
- Existing Customer lost reasons remain low-confidence aggregate learning input.

## Next Stage Dependency

Workflow 1C may later consume an Approved Strategy and Draft Search Task to design connector-backed execution. It must preserve the approval, cost and task-state gates established here.

Workflow 1C has not started.
