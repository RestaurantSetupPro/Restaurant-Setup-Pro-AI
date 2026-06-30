# Product Intelligence Module

## 模块目标

Module 05 将现有 Product Knowledge Center 扩展为平台唯一的 Product Intelligence Center，为 Website、AI Proposal、布局推荐、销售助手、SEO/GEO、客户问答、营销、案例和未来 API 提供 Single Source of Truth。

本模块不接入真实 AI API，不生成真实 AI 图片，不开发 CRM、客户搜索、开发信或下一模块。

## 数据字段

- 基础与商业：Product Name、SKU、Category、Sub Category、Product Series、Material、Size、Color、Finish、MOQ、Lead Time、Price Range、Budget Level、Recommended Usage。
- 关系：Suitable Store Types、Suitable Styles、Recommended Matching Products、Related Categories。
- 销售知识：AI Tags、Sales Notes、Common Questions、Common Objections、Proposal Usage Notes、Sales Talking Points。
- SEO：SEO Title、SEO Description、Meta Keywords、Slug、Canonical URL、Image Alt、Image Caption、Product Keywords。
- GEO：AI Summary、LLM Summary、Use Cases、Best For、Not Recommended For、Comparison、Advantages、Disadvantages、FAQ、Buying/Installation/Maintenance Guide、Common Problems、Suggested Prompt。

多值数据使用现有关联表或新的规范化关联表，不在单字段中复制关系。

## 图片管理规则

支持 Main、Front、Back、Left、Right、45 Degree、Detail、White Background，以及 Coffee Shop、Restaurant、Bubble Tea、Bar 场景图。状态为 Uploaded、AI Generated、Approved 或 Rejected。每个产品只有一个主图；Rejected 图片不计入完整度。

当前保存图片元数据与 URL。`Add AI Generated Image` 仅建立预留记录。

## AI 生成规则

`Generate AI Product Info`、`Generate SEO`、`Generate GEO`、`Generate FAQ` 和 `Generate Buying Guide` 使用确定性规则，不调用外部服务。结果先进入可编辑表单，再由用户保存；API 返回 `requiresHumanReview=true`。

## Proposal Ready 标准

五组各 20 分：基础信息、有效主图、价格/MOQ/交期、AI Tags、Sales Notes。80 分及以上为 `Proposal Ready`，否则为 `Needs Review`。服务端在相关保存后重新计算。

## API

- `GET /api/products`、`GET /api/products/:id`
- `POST|PUT /api/products[/:id]`
- `PUT /api/products/:id/knowledge`
- `GET /api/products/search`
- `POST /api/products/:id/generate/:type`
- `POST /api/products/:id/images`
- `PUT /api/products/:id/images/:mediaId`

生成 type 为 `product-info|seo|geo|faq|buying-guide`。产品接口沿用产品权限；Debug Center 仅 Admin/Owner 可访问。

## 后续 AI 图片生成功能预留说明

未来生成服务必须写回同一 `media_assets` 与 `product_media_links`，保留来源、审批状态和人工主图选择，不得建立另一套产品事实表。真实 AI、对象存储和审核队列须单独立项。
