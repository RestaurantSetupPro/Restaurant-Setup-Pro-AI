# Module Development Standards

Version: 1.0
Applies to: All future Restaurant Setup Pro AI Platform modules

## Mandatory Standard

Every module must include all five engineering tracks:

1. Migration
2. API
3. Debug
4. Test
5. Documentation

A module is not complete when any required track is missing. If a track has no changes, its delivery document must explicitly state `None` and explain why.

## 1. Migration

Every module must assess and document its data impact.

### Required

- Use a numbered, version-controlled migration for every schema change.
- Prefer additive, non-destructive changes.
- Use normalized tables and relationship tables for multi-value data.
- Record the applied migration version.
- Make migrations safe to run more than once where practical.
- Preserve existing production data.
- Define backup and rollback procedures.
- Update the exported schema after successful migration.

### Required Validation

- Migration runs successfully on an empty database.
- Migration runs successfully on the previous accepted schema.
- Existing records remain intact.
- Required tables, columns, indexes, constraints, and relationships are verified.
- Migration status is visible through diagnostics.

### Prohibited

- Unreviewed `DROP`, `TRUNCATE`, or destructive replacement operations
- Storing multiple relationships as unstructured comma-separated text
- Editing an already-released migration without an approved recovery plan
- Claiming a migration succeeded without verification

## 2. API

Every module must define its server contract, even when no new endpoint is required.

### Required

- Document method, path, authentication, authorization, request, response, and errors.
- Enforce role permissions on the server.
- Validate all external input.
- Return consistent JSON errors and appropriate HTTP status codes.
- Preserve backward compatibility unless a breaking change is approved.
- Avoid returning passwords, tokens, database URLs, or internal secrets.
- Add health, readiness, or diagnostics coverage when the module introduces a dependency.

### Required Validation

- Success response
- Invalid-input response
- Unauthenticated response
- Unauthorized-role response
- Duplicate or conflict response where applicable
- Not-found response where applicable

## 3. Debug

Every module must be diagnosable in local and production environments.

### Required

- Add structured logs for initialization and critical workflows.
- Log the stage that failed, not only a generic error.
- Include useful error metadata such as code, constraint, and stack when safe.
- Add module status to the System Debug Center.
- Expose non-secret dependency status through an authorized diagnostics API.
- Provide retry or recovery behavior for transient external failures where appropriate.
- Document how to reproduce and inspect failures.

### Security Rules

- Never log passwords, tokens, cookies, database URLs, or API keys.
- Restrict detailed system diagnostics to Admin and Owner roles.
- Public health endpoints must reveal only minimal status.

## 4. Test

Every module must add automated tests proportional to its risk.

### Required

- Unit tests for important business rules
- API integration tests
- Authentication and role-permission tests
- Migration and schema verification tests
- Regression tests for accepted module behavior
- Error-path and duplicate-data tests
- Browser verification for major UI workflows
- `npm test` with zero failures before delivery

### Test Report

Record:

- Command executed
- Total tests
- Passed, failed, and skipped counts
- Manual browser checks
- Known untested areas
- Production smoke-test result when deployment is in scope

## 5. Documentation

Every module must be understandable without reading its implementation history.

### Required Deliverables

- Module Development Report
- Module README
- CHANGELOG
- Deliverables Summary
- API documentation
- Migration and database summary
- Test results
- Debug and troubleshooting instructions
- Known issues
- Rollback steps
- Architecture document when architecture changes
- Major-page screenshots when UI changes

### Required Updates

- `docs/MODULES.md`
- `docs/ROADMAP.md`
- `docs/DEVELOPMENT.md`
- `docs/BUGS.md` when defects are found or resolved
- `docs/DEPLOYMENT.md` when runtime or environment requirements change

## Module Workflow

### Before Development

1. Confirm the previous module is accepted.
2. Define scope and explicit exclusions.
3. Review Migration, API, Debug, Test, and Documentation impacts.
4. Define acceptance criteria.
5. Confirm product-manager authorization.

### During Development

1. Implement the migration and schema verification.
2. Implement APIs and server-side authorization.
3. Add diagnostics and safe logs.
4. Add automated tests alongside the feature.
5. Update documentation as behavior changes.

### Before Delivery

1. Run the complete test suite.
2. Perform browser verification for major UI pages.
3. Verify migration state and diagnostics.
4. Confirm no secrets are staged in Git.
5. Generate all delivery artifacts.
6. Stop development and wait for formal acceptance.

## Definition of Done

A module is complete only when:

- Migration is applied or explicitly documented as `None`.
- API contracts are implemented and documented or explicitly `None`.
- Debug coverage is visible and usable.
- Automated tests pass with zero failures.
- Documentation and delivery artifacts are complete.
- Known issues and rollback steps are recorded.
- Product manager has enough evidence to perform formal acceptance.

## Compliance Checklist

```text
[ ] Migration reviewed, tested, verified, and documented
[ ] API contract, permissions, validation, and errors verified
[ ] Debug logs and System Debug Center coverage added
[ ] Automated and browser tests passed
[ ] Documentation and delivery artifacts completed
[ ] No secrets committed
[ ] Development stopped pending acceptance
```
