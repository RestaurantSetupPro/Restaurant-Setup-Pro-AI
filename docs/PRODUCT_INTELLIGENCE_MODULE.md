# Product Intelligence Module

## 目标

Product Intelligence Center 是平台唯一产品事实来源，服务 Website、Proposal、销售、SEO/GEO、问答、营销和未来 API。Module 05 建立正式产品智能字段；Module 05.1 在其上增加受审核的 AI Content Factory，不复制或重建 `products`。

## 正式产品数据

- 基础与商业：名称、SKU、分类、系列、材质、尺寸、颜色、表面、MOQ、交期、价格、预算、用途。
- 关系：Store Types、Styles、Matching Products、Cases、Related Categories。
- 销售：AI Tags、Sales Notes、Questions、Objections、Talking Points、Proposal Notes。
- SEO/GEO：标题、描述、关键词、Slug、Canonical、图片文本、AI/LLM Summary、FAQ 与各类指南。

多值正式关系使用规范化关联表。Product Readiness Score 仍按基础信息、主图、商业条件、AI Tags、Sales Notes 五组各 20 分计算。

## Module 05.1 草稿层

`ai_product_content_drafts` 保存规则或未来模型生成的可编辑快照；`ai_image_generation_tasks` 保存图片任务。草稿不能直接覆盖产品，必须经过 Pending Review → Approved → Apply to Product。Apply 只写回现有 Product Intelligence 字段和 `product_keywords`。

## 图片与真实 AI 预留

当前媒体仍写入 `media_assets` / `product_media_links`。Module 05.1 只创建图片任务，不调用图片模型。未来 OpenAI、Gemini、Claude、Flux、Ideogram 等 provider adapter 必须消费任务，并将输出写回 `media_assets`，不得创建第二套产品数据。

完整流程见 [AI Product Content Factory](AI_PRODUCT_CONTENT_FACTORY.md)。
