# Module 04 README

## 功能介绍

Module 04 将产品库升级为 Product Knowledge Engine：

- 产品可关联适用门店类型、风格、特性和目标客户。
- 产品可关联推荐产品、AI 关联产品、项目案例和媒体。
- 每个产品具有 AI Summary、AI Keywords、AI Search Keywords、AI Recommendation Weight、AI Notes、Internal Notes 和 Knowledge Prompt。
- 系统根据媒体、尺寸、材质、案例、关联产品和 Prompt 实时计算 100 分 Knowledge Score。
- 新增 Knowledge Dashboard、Knowledge Top 100 和 Knowledge Incomplete。
- 产品知识详情支持 Knowledge、Media、Related Products 和 Related Cases 标签页。
- 支持关键词、SKU、门店类型、风格、材质、特性和标签组合搜索。

本模块没有开发 Import、Cloudflare、Proposal、CRM 或 AI API。

## 启动

需要 Node.js 24 或更高版本：

```bash
npm start
```

访问：

```text
http://localhost:3000
```

演示账号：

```text
owner@rspro.ai
Welcome123!
```

开发模式：

```bash
npm run dev
```

## 测试

```bash
npm test
```

当前结果：

```text
15 passed
0 failed
```

手工验收建议：

1. 登录后打开 Knowledge Dashboard。
2. 检查 Knowledge Score、缺少图片/尺寸/案例数量。
3. 进入 Product Knowledge Center，组合选择 Store Type、Style、Material 和 Feature。
4. 打开某个产品知识详情。
5. 在 Knowledge Tab 中选择门店、风格、特性和客户类型。
6. 填写 AI-ready 字段和 Knowledge Prompt。
7. 在 Media、Related Products、Related Cases 中建立关联。
8. 保存后确认 Knowledge Score 即时更新。

## 目录说明

```text
database/schema.sql                 Module 04 规范化关系结构
src/server.mjs                     知识评分、搜索、详情和更新 API
public/app.js                      知识看板、组合筛选和产品知识详情
public/styles.css                  Module 04 UI 样式
public/locales/                    中英文文案
tests/integration.test.mjs         Module 04 与回归测试
outputs/Module-04/                 正式验收资料
```

## 注意事项

- `products.tags` 是历史兼容字段；知识关系必须使用新关联表。
- Knowledge Score 为实时计算值，不单独存储。
- AI 字段目前由人工维护，不会调用外部 AI。
- Media 仅关联元数据，不包含上传与云存储。
- 搜索 API 当前每次最多返回 500 条记录。
- 本模块完成后已停止继续开发，等待产品经理验收。
