# Module 05.2 Architecture

```text
Image Task API
  ↓ confirmation + max-per-run + role/state validation
Provider Factory
  ├─ mock adapter
  └─ openai adapter (key required, otherwise mock fallback)
  ↓ normalized bytes + metadata
Generated Storage Adapter
  ↓ URL
media_assets (AI Generated, unlinked)
  ↓ review Approve/Reject
Apply
  ↓
product_media_links (non-primary) + Approved media
```

`status_history` records lifecycle transitions. Provider secrets never enter diagnostics or database. Production storage can replace the local adapter without changing task/review business code.
