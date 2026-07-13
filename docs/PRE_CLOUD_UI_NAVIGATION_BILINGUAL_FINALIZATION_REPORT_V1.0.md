# Restaurant AI Sales OS — Pre-Cloud UI, Navigation and Bilingual Finalization Report V1.0

## 1. Scope and outcome

This finalization standardizes the existing Restaurant AI Sales OS user interface before cloud verification. It does not add a real Connector, start Workflow 1D, or change the Workflow 1C business data flow.

The completed scope covers centralized English/Chinese localization, role-aware navigation, Opportunity Intelligence tabs, status and history labels, date/money/number formatting, and desktop-safe layout behavior.

## 2. Localization source of truth

- `public/locales/en.js` and `public/locales/zh-CN.js` are the paired translation resources.
- `public/i18n.js` is the single runtime translation and formatting boundary.
- English and Chinese resources must retain identical key coverage.
- Missing keys produce a development warning on local development hosts, while the UI displays a readable fallback rather than a raw internal key.
- Legacy templates are localized at the render boundary through the centralized dictionary; new UI must call translation keys directly.

## 3. Language preference

Language selection is resolved in this order:

1. authenticated user preference, when supplied by the server;
2. the persisted browser preference (`rsp.locale`);
3. the application default.

The selected language is applied before the application shell renders and persists across refreshes. Logout does not erase the browser preference.

## 4. Unified terminology

The canonical bilingual terms include:

| English | 中文 |
| --- | --- |
| Opportunity Intelligence | 商机智能 |
| Lead Pool | 潜在线索池 |
| Search Strategies | 搜索策略 |
| Search Tasks | 搜索任务 |
| Priority View | 优先级视图 |
| Products & Knowledge | 产品与知识 |
| Customer Management | 客户管理 |
| Proposal Generator | 方案生成器 |
| Debug Center | 调试中心 |
| System Settings | 系统设置 |

## 5. Display roles

Database role enums are unchanged. The UI exposes five business-facing role labels:

| Role key | English display | 中文显示 |
| --- | --- | --- |
| Admin | System Administrator | 系统管理员 |
| Owner | Business Administrator | 企业管理员 |
| Sales | Sales Representative | 销售人员 |
| Designer | Solution Specialist | 方案专员 |
| VA | Operations Specialist | 运营专员 |

Legacy role values remain compatible but are not exposed as an additional role in the menu or demo role switcher.

## 6. Navigation source of truth

The application navigation is defined by one configuration. Each item records its translation key, route, icon, group, allowed roles, required permission, order, feature availability, and active-route matching rules.

The five fixed groups, in order, are:

1. Workspace
2. Opportunities & Customers
3. Products & Knowledge
4. Solutions & Commercial
5. System

Menu construction filters the same configuration by role and permission, sorts it deterministically, and deduplicates IDs and routes. Re-rendering the shell cannot append category records or duplicate Product Library child items.

## 7. Role visibility

- Admin: all available modules, including Base Configuration and Debug Center.
- Owner: business modules and System Settings; deep technical configuration and debugging are hidden.
- Sales: sales workflow, customers, Opportunity Intelligence, products/knowledge, proposals, quotations, orders, cases, and approved AI workspaces.
- Designer: tasks, customers, product knowledge/master data, images, proposals, and cases; Opportunity Intelligence and commercial-cost modules are excluded.
- VA: operational tasks, Opportunity Intelligence, customers, product/master data, knowledge, and imports.

Required permissions remain an additional gate; this finalization does not broaden authorization.

## 8. Opportunity Intelligence navigation

The seven canonical tabs are Dashboard, AI Discovery, Search Strategies, Search Tasks, Lead Pool, Customers, and Priority View. Their labels and counters localize as complete units. Tab switching clears stale detail state and re-renders the selected view without a browser refresh.

## 9. Status and activity history

Workflow, AI, lead, execution, product connection, and review statuses use centralized bilingual labels. Raw database values remain unchanged so status colors and existing backend contracts are preserved.

Activity history labels are localized independently from business state. In particular, AI Qualified and human Reviewed remain separate events.

## 10. Dates, money, numbers, and quantities

The runtime formatter provides locale-aware date/time, date-only, currency, quantity, and percentage output. Stored values are not reformatted or mutated in the database. Chinese date/time output is stable and readable; English output follows the active English locale.

## 11. Workflow 1C UI compatibility

Search Task criteria, execution statistics, Search Results statistics, Lead Detail evidence, AI qualification, and activity history retain their semantic DOM structure. Labels, values, units, and descriptions are separate nodes, preventing text adhesion and preserving the already accepted Workflow 1C behavior.

## 12. Layout behavior

Navigation labels and content fields wrap safely. Page content has a controlled desktop maximum width, while tables use contained horizontal scrolling on small screens. The CSS contracts cover 1280px, 1440px, and 1920px desktop widths and retain basic mobile safety.

## 13. Automated coverage

Automated tests cover:

- exact English/Chinese key parity;
- missing-key fallback and development warnings;
- language persistence and pre-render preference application;
- the five navigation groups and configuration contract;
- role visibility, ordering, permissions, and repeated-render deduplication;
- all seven Opportunity Intelligence tabs and repeated switching;
- bilingual actions, terminology, statuses, and history;
- date, money, quantity, and percentage formatting;
- Workflow 1C semantic label/value nodes;
- desktop wrapping and safe table overflow contracts;
- absence of hard-coded Chinese copy in the main application templates.

## 14. Manual UI verification

Manual browser checks confirmed English/Chinese switching and refresh persistence, Owner and Admin navigation presentation, the Chinese Opportunity Intelligence dashboard, Search Task #006 details, Search Execution statistics, Search Results statistics, and Lead Detail bilingual evidence/history presentation.

## 15. Business data protection

This work does not create, delete, or convert Search Results, Leads, or Customers. Final verification must retain:

- Customers: 13
- Lead Pool: 7
- Search Task #006
- five Rules/Mock results linked to Search Task #006

## 16. Explicit exclusions

This finalization does not include a Google Maps, Apollo, website, or other real Connector; Workflow 1D; cloud deployment verification; automatic Lead/Customer creation; qualification algorithm changes; or external messaging.

## 17. Maintenance rule

All new user-visible copy must be added to both locale resources before release. New navigation entries must extend the single navigation configuration and declare their role, permission, ordering, availability, and active matching behavior. New raw status values must receive bilingual display mappings without changing the stored enum solely for presentation.

## 18. Release gate

Release is ready for the separate cloud verification phase only when the complete test suite passes, protected Workflow 1C record counts remain unchanged, the worktree is clean, and the committed branch is synchronized with its GitHub remote.
