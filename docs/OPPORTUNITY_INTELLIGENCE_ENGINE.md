# Opportunity Intelligence Engine

## Module goal

Module 06A converts sourced customer records into prioritized, reviewable sales opportunities. It is not a general CRM and does not send messages automatically. Every record keeps its source, source URL, confidence, timestamps, AI run snapshots, and activity history.

## AI pipeline

1. Normalize company, location, URL, email, phone, and social data.
2. Detect duplicate company/location records.
3. Detect missing website, email, WhatsApp, decision maker, LinkedIn, Instagram, store count, and opening year.
4. Calculate data quality and Opportunity Score.
5. Query Product Intelligence Center by store type and category; save only product/category IDs and reasons.
6. Generate next action and a personalized outreach draft.
7. Move contactable A+/A records to Ready for Sales.
8. Require human editing, approval, manual sending, and sales acceptance.

The v1 provider is deterministic `rules-1.0`. `OPPORTUNITY_AI_PROVIDER=rules` is optional and the analysis-run table records provider/version so OpenAI, Gemini, Claude, or Qwen adapters can be added without changing customer tables.

## Opportunity Score

The maximum is 100:

- Business Fit: 15 points for Coffee Shop, Restaurant, Bubble Tea, Bar, Bakery, Hotel, or Food Court.
- Years in Business: 15 points at three years or more.
- Store Count: 15 points at two stores or more.
- Contactability: 20 points, five each for email, WhatsApp, website, and a primary decision maker.
- Expansion/Renovation/Furniture Signals: 20 points based on the three probability values.
- Product Match: 10 points when Product Intelligence provides at least one match.
- Data Quality: 5 points based on profile completeness.

Grades: A+ 90–100, A 75–89, B 60–74, C 40–59, D 0–39.

## Product matching

Matching reads the existing `products`, `product_categories`, and normalized product knowledge relationships. It writes references to `customer_product_recommendations`; it never copies canonical product content. Store type selects relevant directions such as Booth Seating, Dining Chair, Restaurant Table, Bar Stool, Outdoor Furniture, Counter / Service Bar, and Partition / Divider. Proposal readiness and AI recommendation weight influence ordering.

## Data gaps

Gaps use High, Medium, or Low priority and Open, Filled, or Ignored status. VA users can research and close gaps but cannot run AI or modify Opportunity Score.

## Outreach workflow

AI creates an editable Draft/Ready message using store type, location, store count, expansion/remodel signals, recommended categories, factory-direct positioning, modular/project packages, and DDP where applicable. Admin/Owner approves. Sales can review, edit, and mark it Sent Manually. No WhatsApp, Facebook, LinkedIn, or email sending API is called.

## Sales handoff

A customer qualifies when the grade is A+ or A and at least one of email, WhatsApp, website, or primary decision maker exists. The system sets Ready for Sales. Sales uses Accept Lead, which assigns the lead and changes status to In Progress.

## Permissions

- Admin / Owner: full module access, AI runs, overrides, approvals, and handoff.
- Sales: view intelligence/drafts, edit outreach, mark manual send, accept lead, and update sales status; no delete.
- VA: import, edit basic sourced data, add contacts, and close gaps; no score changes or outreach approval.
- Designer: no module access in v1.

## Future integrations

Google Maps, Apollo, Hunter, LinkedIn, and email providers should be implemented as explicit adapters with rate limits, consent/compliance checks, source attribution, confidence, and audit events. External enrichment must write through the same customer pipeline. Sending providers must remain human-confirmed. Product recommendations must continue to reference Product Intelligence Center as the single source of truth.
# AI Cost Control Integration

Single and selected-customer AI runs pass through the shared cost framework. Rules-based scoring, product matching, and outreach drafting are logged at zero actual cost. Customer runs are cached for seven days by default and can be intentionally repeated with `regenerate: true`.
