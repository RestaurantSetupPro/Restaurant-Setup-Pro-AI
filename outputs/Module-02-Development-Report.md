# Module 02 Development Report

## 1. Completed Features

- Added Core Foundation Center without replacing Module 01 authentication, RBAC, navigation, or page shell.
- Config Center supports create, edit, sort order, search, type/status filters, and Active/Inactive lifecycle.
- Tag Center supports shared tags, create/edit/deactivate, search/filter, and case-insensitive unique name/code enforcement.
- Media Center foundation supports metadata records only. AI-generated media automatically receives `AI Generated Preview - Not for Production Use`.
- Prompt Center foundation supports create, view/edit, version, variables, and Active/Inactive lifecycle. No AI API is connected.
- All mutations are recorded in the existing audit log. No physical-delete endpoint was introduced.

## 2. Database Changes

- Extended `database/schema.sql` additively; existing Module 01 tables remain unchanged.
- Added Active/Inactive lifecycle fields, optional creator references, timestamps, uniqueness constraints, and lookup indexes.
- Added `is_system` to identify seeded default records and preserve them as system foundations.

## 3. New Tables

- `system_configs`
- `system_tags`
- `media_assets`
- `ai_prompts`

Indexes were added for `config_type`, config `code`, `tag_type`, tag `code`, `related_module`, `related_record_id`, and `prompt_type`.

## 4. Seed Data

- Product Categories: 7
- Store Types: 7
- Styles: 8
- Materials: 9
- Currencies: 4
- Units: 6
- CRM Signal Types: 6
- Store Type Tags: 7
- Style Tags: 8
- Business Tags: 7
- Product Feature Tags: 6
- Customer Signal Tags: 6

Seeds are idempotent through unique constraints and `INSERT OR IGNORE`.

## 5. New UI Pages / Tabs

- Added `Core Foundation Center` to the existing system navigation.
- Added tabs: Config Center, Tag Center, Media Center, Prompt Center.
- Every accessible tab includes list, search, type/status filtering, Add, Edit, and Active/Inactive controls according to role permissions.
- Added responsive tab, table, switch, warning, and modal styles using the existing design system.

## 6. Permission Changes

- Admin: view and edit all four centers.
- Owner: view and edit all four centers; no delete operation exists, so system defaults cannot be physically deleted.
- Sales: read-only Config Center and Tag Center; Media and Prompt sections are restricted.
- Designer: read-only Styles, Materials, all tags, and Media Center metadata; Prompt Center is restricted.
- VA: read-only Config Center and Tag Center; Media and Prompt sections are restricted.
- Server-side checks enforce all write restrictions independently of UI visibility.

## 7. i18n Changes

- Added matching English and Simplified Chinese keys for navigation, tabs, fields, actions, filters, states, access notices, validation feedback, and forms.
- Existing shared i18n module and language switcher remain in use.
- Automated key-parity coverage verifies English and Chinese resources remain aligned.

## 8. Tests Added

- Seed presence and foundation metadata coverage.
- Admin configuration create/edit/sort/deactivate flow.
- Case-insensitive global tag name/code uniqueness.
- Mandatory AI-generated media usage warning.
- Prompt creation.
- Sales read-only API enforcement.
- Designer material/style/media access scope.
- Updated Module 01 permission and i18n expectations.
- Result: 13 tests passed, 0 failed.

## 9. Known Issues

- Actual cloud upload, file validation, thumbnails, and storage-provider integration are intentionally not implemented in this foundation module.
- Prompt execution and AI provider integration are intentionally deferred.
- The in-app browser controller did not complete localhost navigation during final visual QA. API, syntax, i18n, and integration suites passed; a manual browser smoke check is still recommended in the target desktop environment.

## 10. Next Module Dependencies

- Product Knowledge Center can reference `system_configs`, `system_tags`, and `media_assets` for categories, styles, materials, features, and photos.
- Opportunity CRM can use Store Types, CRM Signal Types, Customer Signal Tags, countries, regions, currencies, and priorities.
- Project Case Library and Content Center can share tags and verified media records.
- Proposal Builder can use statuses, currencies, units, media, and prompt templates.
- AI Sales Center can consume active prompt versions and AI Recommendation Tags after an AI provider is connected.
