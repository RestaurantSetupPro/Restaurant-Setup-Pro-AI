# Module 03 README

## 本模块功能介绍

Module 03 为产品知识中心增加了可实际使用的 SKU 与产品标签工作流：

- 按“产品类别代码 + 风格代码 + 三位流水号”自动生成 SKU，例如 `BS-JP-001`。
- SKU 在服务端按不区分大小写的规则保持唯一。
- 允许手动修改 SKU；若重复，保存会被拒绝。
- 产品可以绑定多个 Store Type Tags、Style Tags 和 Business Tags。
- 产品列表显示标签，并支持关键词、分类、状态和标签组合筛选。
- 支持新增和编辑产品，所有写入均受现有登录权限控制并记录审计事件。
- 中英文界面文案保持一致覆盖。

Module 03 复用 Module 02 的分类与标签字典，没有继续开发 Module 04。

## 如何启动

环境要求：Node.js 24 或更高版本。

标准启动：

```bash
npm start
```

开发模式：

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

演示账号：

```text
owner@rspro.ai
```

演示密码：

```text
Welcome123!
```

如需指定端口（PowerShell）：

```powershell
$env:PORT = "4173"
npm start
```

## 如何测试

运行完整自动测试：

```bash
npm test
```

当前验收结果：

```text
14 passed
0 failed
```

建议手工验收步骤：

1. 使用 Owner 或 Admin 登录。
2. 进入 Product Knowledge Center。
3. 点击 Add product。
4. 选择产品分类和 SKU style，然后点击 Generate。
5. 选择三类标签中的多个标签并保存。
6. 确认列表显示自动生成的 SKU 和标签。
7. 打开 Edit，手动修改 SKU 并保存。
8. 尝试输入已存在 SKU，确认系统提示重复。
9. 验证关键词、分类、状态和标签筛选。

## 目录说明

```text
database/
└── schema.sql                         数据库完整结构

src/
└── server.mjs                        SKU 规则、产品 API、标签关联与校验

public/
├── app.js                            产品列表、筛选、新增/编辑交互
├── styles.css                        SKU、标签和产品弹窗样式
└── locales/
    ├── en.js                         英文文案
    └── zh-CN.js                      简体中文文案

tests/
├── integration.test.mjs              SKU、标签、API、权限集成测试
└── i18n.test.mjs                     中英文资源一致性测试

outputs/Module-03/
├── Module-03-Development-Report.md   开发报告
├── Module-03-README.md               本文件
├── CHANGELOG.md                      版本变更记录
├── Module-03-Architecture.md         架构说明
├── Module-03-Deliverables.md         交付汇总
├── Database/
│   └── schema.sql                    本模块验收用数据库结构导出
└── Screenshots/                      1920×1080 验收截图
```

## 注意事项

- 新建产品时若不手动填写 SKU，服务端会根据分类和风格生成下一流水号。
- 在创建弹窗中修改分类或风格后，请点击 **Generate** 刷新前端 SKU 预览。
- SKU 唯一性不区分大小写。
- 产品仅允许绑定启用状态的 Store Type Tags、Style Tags 和 Business Tags。
- `products.tags` 是兼容历史数据的旧文本字段；新功能使用 `product_tag_links`。
- 当前 Product Detail 由编辑弹窗承载，没有独立只读详情页。
- 当前 Media Center 只管理媒体元数据，Module 03 没有实现产品媒体上传或绑定。
- 本模块仅完成本地部署验收；生产环境仍需独立的安全、备份和并发评估。
- Module 04 尚未开始，需等待产品经理正式验收。
