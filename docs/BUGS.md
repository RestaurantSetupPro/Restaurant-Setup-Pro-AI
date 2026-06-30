# Bug Log

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
