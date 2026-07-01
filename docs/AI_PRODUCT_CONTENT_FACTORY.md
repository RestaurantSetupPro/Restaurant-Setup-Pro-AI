# AI Product Content Factory

## Goal

Convert an approved source product image and Product Intelligence record into reviewable sales content and executable image tasks without copying the product source of truth.

## Workflow

Generate Everything → content draft + image tasks → run provider → save generated media → Pending Review → Approve/Reject → Apply to Product.

Text drafts and image tasks have separate reviews. Neither generated content nor generated media becomes formal product data before Apply.

## Modes and Costs

| Mode | Text | Image tasks | Simulated estimate |
| --- | --- | ---: | ---: |
| Fast | Yes | 0 | $0.01 text |
| Standard | Yes | 3 | $0.05/task |
| Premium | Yes | 14 | $0.15/task |

`AI_IMAGE_MAX_PER_RUN` limits execution batches; Premium runs are intentionally chunked.

## Image Execution

The Factory uses the adapter contract documented in [AI Image Generation Provider](AI_IMAGE_GENERATION_PROVIDER.md). Prompt and negative prompt remain editable while a task is draft, pending or failed. Generated files are previewable but remain unlinked from `product_media_links` until approved and applied.

## Permissions

- Admin, Owner, Designer: create, edit, run, retry, cancel, review and apply.
- Sales: view Approved/Applied drafts and images only.
- VA: Factory unavailable.

## APIs

Content draft APIs remain under `/api/products/:id/ai-content`. Image task create/list/update/run/batch/retry/cancel/review/apply APIs remain under `/api/products/:id/image-generation-tasks`. Every mutation validates product ownership, role and lifecycle state.
# AI Cost Control Integration

Generate Everything creates a cost estimate and requires confirmation. Rules output records zero actual cost, while future paid text providers must pass the central provider and budget guard. Draft caching is isolated by product, mode, and operator.
