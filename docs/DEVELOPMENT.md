# Development

All modules follow [Module Development Standards](Development-Standards.md): Migration, API, Debug, Test, and Documentation are mandatory.

## Start and Test

Requires Node.js 24+ and npm.

```bash
npm install
npm start
npm test
```

SQLite is used locally when `DATABASE_URL` is absent. PostgreSQL is used when configured.

## Module 05 Rules

- Extend `products`; never rebuild or duplicate it.
- Store multi-value relationships in normalized link tables.
- Generated AI/SEO/GEO content is deterministic, editable, and requires human review.
- Image management stores metadata and URLs; binary storage is outside Module 05.
- Preserve PostgreSQL and local SQLite compatibility.

## Paths

- `src/server.mjs`: API, generation rules, score, diagnostics
- `public/`: Product Intelligence Center UI
- `database/migrations/002_product_intelligence.sql`: additive migration
- `tests/`: regression and Module 05 integration tests
- `docs/PRODUCT_INTELLIGENCE_MODULE.md`: module contract
- `outputs/Module-05/`: acceptance package
