# Alpha Test Issue 008 - Product Create Permission

## Result

Passed. Owner and Sales Admin can create and edit products without an Access denied response.

## Fix

- Added explicit Product Library management authorization.
- Allowed Owner and Sales Admin product create/update operations.
- Added Sales Admin identity mapping and demo account: `salesadmin@rspro.ai`.
- Preserved Admin access.
- Standard Sales, Designer, and VA users do not receive unintended product-write authority.
- Product creation uses the existing PostgreSQL/SQLite-compatible insert path.

## Authentication and Request Security

- Authentication middleware resolves the active database session and user role before authorization.
- Session cookie is HttpOnly and SameSite=Lax.
- The application uses same-origin JSON requests; no CSRF middleware is blocking the product endpoint.
- Product endpoint: `POST /api/products`.
- Product edit endpoint: `PUT /api/products/:id`.

## Acceptance Verification

- Owner created a product: passed.
- Owner edited the created product: passed.
- Sales Admin created a product: passed.
- Sales Admin edited the created product: passed.
- Both products appeared immediately in Product Library: passed.
- UI success message remains `Product created successfully.`
- Full automated regression: 28 passed, 0 failed.

Module08B was not started.
