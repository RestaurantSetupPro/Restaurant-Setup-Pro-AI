# Development

All modules require Migration, API, Debug, Test and Documentation tracks.

## Start and Test

```bash
npm install
npm start
npm test
```

Node.js 24+ is required. SQLite is the local fallback; PostgreSQL is used when `DATABASE_URL` exists.

## Module 05.1 Rules

- Run migrations in numeric order through `003_ai_product_content_factory.sql`.
- Never write generated content directly to `products` during generation or review.
- Generate/edit/review/apply roles: Admin, Owner, Designer.
- Sales reads Approved/Applied content only; VA has no Factory access.
- Provider values are interface reservations, not active external calls.
- Image outputs must eventually return through `media_assets`.

## Important Paths

- `src/server.mjs`: factory rules, workflow, permissions, APIs, diagnostics
- `public/app.js`: AI Content Factory tab and review UI
- `database/migrations/003_ai_product_content_factory.sql`: additive PostgreSQL migration
- `tests/integration.test.mjs`: generation, review, apply and role tests
- `docs/AI_PRODUCT_CONTENT_FACTORY.md`: functional and API contract
- `outputs/Module-05.1/`: acceptance package
