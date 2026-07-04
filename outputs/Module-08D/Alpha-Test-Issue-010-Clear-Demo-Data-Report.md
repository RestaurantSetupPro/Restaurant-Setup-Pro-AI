# Alpha Test Issue 010 — Clear Demo Data

## Fixed

`Clear Demo Data` now removes all current Product Library and import trial data, rather than matching only a small hard-coded SKU/file list.

Deleted data includes Products, Variants, Product media links/assets, attribute values, Product tags, relationships, Frequently Bought Together, import batches, drafts, assets, errors, legacy import jobs, and generated files under `public/imports`.

Preserved data includes Categories, Attribute Templates, Master Data, Price Rules, Users, Permissions, Company Settings, and Quote/PI templates.

The success response reports:

- Products deleted
- Variants deleted
- Import batches deleted
- Drafts deleted

The Import Center refreshes immediately and Product Library state is invalidated so its next view displays the empty library. A persistent cleanup setting prevents Demo Products from being seeded again after restart.

## Verification

`npm test`: **32 passed, 0 failed**.

Verified empty Products, empty import batches/drafts, retained Categories, retained Attribute Templates, retained Price Rules, and success deletion counts.
