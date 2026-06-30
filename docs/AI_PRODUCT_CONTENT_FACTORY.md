# AI Product Content Factory

## 模块目标

把一张已关联产品图和现有 Product Intelligence 数据转换为可编辑、可审核、可应用的销售资料。第一版使用规则模拟，保持未来多模型接入能力。

## 工作流

Analyze Product Image → Generate Product Info/SEO/GEO/FAQ/Sales/Proposal → Generate Image Tasks → Save Draft → Pending Review → Approve or Reject → Apply to Product。

生成与审核阶段只写 `ai_product_content_drafts`。只有 Approved 草稿可 Apply；Apply 后写入现有产品字段与 AI Tags。

## 生成模式与成本

| Mode | Content | Image Tasks | Estimate |
| --- | --- | ---: | ---: |
| Fast | Text | 0 | Text $0.01 |
| Standard | Text + Coffee Shop, Restaurant, White Background | 3 | $0.05/task + text |
| Premium | Text + views, detail, white/transparent and six scenes | 14 | $0.15/task + text |

成本只是计划值，不扣费。

## 审核与权限

- Admin/Owner/Designer：Generate、Edit、Approve/Reject、Apply。
- Sales：仅查看 Approved/Applied 草稿，不能生成或审核。
- VA：Factory 不可见。
- Applied 草稿不可再次编辑；未 Approved 草稿不可 Apply。

## 数据设计

- `ai_product_content_drafts`：生成快照、状态、审核、成本与源图片。
- `ai_image_generation_tasks`：product/source/output media、类型、场景、prompt、provider、状态、成本与审核。
- `products`：仍是正式单一数据源，没有重建或复制。
- `media_assets`：未来图片输出的唯一回写位置。

## API

- `POST /api/products/:id/ai-content/generate`
- `GET /api/products/:id/ai-content/drafts`
- `PUT /api/products/:id/ai-content/drafts/:draftId`
- `POST /api/products/:id/ai-content/drafts/:draftId/approve`
- `POST /api/products/:id/ai-content/drafts/:draftId/reject`
- `POST /api/products/:id/ai-content/drafts/:draftId/apply`
- `GET|POST /api/products/:id/image-generation-tasks`

服务端检查身份、角色、产品归属、source media、mode/provider、状态转换和 Apply 前置条件。

## 真实 AI API 预留

后续以 provider adapter 消费草稿或图片任务，支持 OpenAI/Gemini/Claude/Flux/Ideogram。Adapter 必须保留 prompt、成本、失败状态和审核记录；图片成功后创建 `media_assets` 并设置 `output_media_id`。不得绕过审核直接改产品。
