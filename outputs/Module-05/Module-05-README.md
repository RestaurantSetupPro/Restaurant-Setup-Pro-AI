# Module 05 README

## 功能

Product Intelligence Center 扩展产品商业、销售、图片、SEO/GEO、规则生成、筛选和 Proposal Readiness，同时保持 Module 01–04 行为。

## 启动

```bash
npm install
npm start
```

访问 `http://localhost:3000`，使用 Admin/Owner 进入 Products 和 System Debug Center。

## 测试

```bash
npm test
```

确认 `/api/health`、`/api/debug/db`、产品列表、详情、保存、筛选、生成、图片和 readiness。

## 目录

- `database/migrations/002_product_intelligence.sql`：生产迁移
- `src/server.mjs`：API 与业务规则
- `public/`：界面
- `tests/`：自动化验证
- `docs/PRODUCT_INTELLIGENCE_MODULE.md`：详细规范

## 注意事项

生成内容必须人工检查后保存；图片入口当前只保存 URL/元数据；不要提交密钥或本地数据库；不要继续下一模块。
