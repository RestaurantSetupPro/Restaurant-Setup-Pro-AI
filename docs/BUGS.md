# Bug Log

## Alpha Test Issue 010 — Resolved

Clear Demo Data now clears the complete Product Library/import trial dataset, refreshes cached UI state, reports deletion counts, preserves master/configuration data and Price Rules, and prevents Demo Product reseeding after restart.

## Module08D

- No blocking issue after 31-test regression.
- Minimum margin is reserved in the rule schema for future reporting; it does not replace the specified multiplier/add-on formula.

## Module08C

- No open blocking issue after the Business Readiness regression run.
- Production object storage for embedded spreadsheet images remains a deployment improvement; local imports use the existing public import directory.

## Open / Limitations

- Local generated files are not durable on ephemeral cloud instances; use Supabase Storage or R2 in production.
- OpenAI generation requires account access, billing and `OPENAI_API_KEY`; automated tests do not call paid APIs.
- The current OpenAI adapter generates from prompt/context. High-fidelity source-image editing and masking require a future adapter enhancement.
- Runs execute in the HTTP process; production volume should use an asynchronous queue/worker.
- Mock output is a reviewable SVG placeholder, not production photography.

## Resolved

- Missing OpenAI keys safely fall back to mock.
- Batch runs enforce configured maximum size.
- Failed tasks preserve errors and can be edited/retried.
- Generated images cannot become product media without review and Apply.
- Sales cannot run, review or apply images.
- Debug Center shows provider configuration and lifecycle counts without secrets.

## Template

Record date, environment, severity, reproduction, expected/actual result, non-secret logs, owner and status.
# Module 06A known limitations

- CSV parsing supports straightforward comma-separated rows and does not yet handle quoted commas.
- Batch text format is pipe-delimited and limited to 500 rows per request.
- The rules provider does not call external enrichment or LLM APIs.
- No automated email, WhatsApp, Facebook, or LinkedIn sending is implemented.
- Production enrichment must add compliance, rate-limit, and source-confidence controls.
# Module 06A Supplement 01

- No known blocking defect.
- Real provider actual-cost reconciliation depends on future provider billing metadata; current paid estimates are logged conservatively.
# Module 07 Part 1

- No known blocking defects.
- PDF/PI export and real freight-rate calculation are intentionally outside Part 1.
# Module 07 Part 2

- No known blocking defects.
- WhatsApp/email are generated for human sending; direct provider sending is intentionally excluded.
- Freight cost is entered after external confirmation; no carrier API is connected.
- Custom item reference images currently use URLs/references; binary object-storage upload remains future work.
