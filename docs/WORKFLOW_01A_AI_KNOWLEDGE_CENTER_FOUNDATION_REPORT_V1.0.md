# Workflow 1A AI Knowledge Center Foundation Report V1.0

## Business Goal

Provide a human-reviewed foundation for Company Knowledge and Target Customer Profile Knowledge. AI uses only the latest approved Active revision; drafts and historical revisions never enter formal context.

## Reused Modules

- Existing users, roles, Knowledge Dashboard and Debug Center
- Product Library, Product Foundation and Product Knowledge Engine
- Product Intelligence read APIs and price-engine data
- Customer activity, score history, feedback, quotes and orders
- AI Business Brain, AI Context Builder, AI Cost Control and context snapshots
- `audit_log` for all lifecycle transitions

## Database

Migration `025_v53_ai_knowledge_center_foundation.sql` adds the only new business table, `knowledge_items`. It stores both knowledge types and retains history as immutable revisions in the same table. A partial unique index enforces one Active revision per `knowledge_key`.

## State Machine

`Draft -> Needs Review -> Active -> Outdated -> Archived`

Admin and Owner approve, mark outdated and archive. Request Changes returns Needs Review to Draft. Editing Active creates a new Draft revision; approval replaces the old Active in one transaction.

## API

- `GET/POST /api/knowledge-center`
- `GET/PUT /api/knowledge-center/:id`
- `GET /api/knowledge-center/:id/history`
- `POST /api/knowledge-center/:id/submit-review`
- `POST /api/knowledge-center/:id/approve`
- `POST /api/knowledge-center/:id/request-changes`
- `POST /api/knowledge-center/:id/mark-outdated`
- `POST /api/knowledge-center/:id/archive`
- `GET /api/knowledge-center/context-preview`

No delete API exists.

## Page Flow

The existing Knowledge Dashboard now includes Company Knowledge and Target Customer Profiles. Users enter structured fields through a short form, save Draft, submit for review and follow role-appropriate actions. History and a deterministic Context Preview are available without exposing raw JSON.

## Permissions

Admin and Owner manage all revisions and approvals. Sales and VA can create and edit their own Drafts, submit review and view Active Knowledge. Designer has Active read-only access. Server-side filtering protects every API response and context.

## AI Context Builder

New context types are `company-knowledge`, `target-customer-profile` and `knowledge-center`. Output includes approved knowledge, optional Product Knowledge, role-filtered pricing guidance, restricted aggregate customer learning, source references, warnings, redaction level and a revision-aware context hash.

## Cost Control

Knowledge CRUD, review, approval and Context Preview are deterministic and cost zero. No AI rewrite button was added. Any future AI suggestion must use AI Business Brain and AI Cost Control; AI cannot approve knowledge.

## Debug

Debug Center reports type/status counts, Active, Needs Review, Outdated, keys without Active, last approval time and the single-Active constraint check. It does not return knowledge bodies, supplier cost, margin or customer detail.

## Test Results

Syntax, full regression, health and debug checks are required before completion. Automated coverage includes migration safety, revision lifecycle, role permissions, Active-only context, zero-cost preview, sensitive-field redaction, audit behavior and existing module regression.

## Known Limitations

- Lost reasons are not structured, so customer-learning output is explicitly low confidence.
- The first UI form exposes the most common structured fields; less common contract fields can be added later without changing the table.
- Paid provider execution remains governed by the existing provider readiness and Cost Control configuration.

## Next Dependency

Workflow 1B may consume approved Knowledge Center context only after separate human approval. Search Strategy, Search Execution and connectors are not part of Workflow 1A.

## Scope Confirmation

Workflow 1B has not started. No Lead, Customer CRM, Quote, PI, Price Engine, search execution or connector behavior was rebuilt or extended.
