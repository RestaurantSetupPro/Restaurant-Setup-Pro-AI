0. 系统一句话定义

Restaurant Setup Pro 是一个 AI 驱动的餐饮商业空间机会发现 + 项目分析 + 供应链匹配 + 报价生成系统。

核心不是客户管理，而是：

Opportunity → Project → Decision Chain → Solution → Quote

1. 商业逻辑（绝对不可修改）
1.1 核心业务不是“卖家具”

系统本质做三件事：

（1）发现机会
新餐厅项目
餐饮扩店
设计公司新项目
商业空间改造
（2）解析机会关系链

必须识别：

Project（项目）
Owner（甲方）
Designer（设计公司）
Contractor（施工方）
Supplier（供应链）
（3）输出解决方案
家具配置
卡座方案
吧台方案
模块化产品组合
PI / BOM
报价建议
2. 核心数据结构（Codex必须严格执行）
2.1 Project（项目表）
{
  "project_id": "",
  "project_name": "",
  "business_type": "restaurant | cafe | bar | bubble_tea",
  "country": "",
  "city": "",
  "stage": "concept | design | construction | opening | opened",
  "budget_level": "low | medium | high | unknown",
  "source": "",
  "confidence_score": 0-100
}
2.2 Company（公司表）
{
  "company_id": "",
  "name": "",
  "type": "owner | designer | contractor | dealer | supplier",
  "country": "",
  "website": "",
  "linkedin": "",
  "instagram": ""
}
2.3 Contact（联系人表）
{
  "contact_id": "",
  "name": "",
  "role": "",
  "company_id": "",
  "email": "",
  "phone": "",
  "source": ""
}
2.4 Opportunity（机会表）
{
  "opportunity_id": "",
  "project_id": "",
  "score": "S | A | B | C | D",
  "estimated_value": "",
  "recommended_action": "",
  "status": "new | reviewed | contacted | negotiating | lost | won"
}
2.5 Message（沟通记录）
{
  "message_id": "",
  "opportunity_id": "",
  "channel": "email | linkedin | whatsapp | instagram",
  "content": "",
  "type": "first_contact | follow_up | proposal",
  "status": "sent | replied | failed"
}
3. AI Agent体系（Codex必须严格实现，不可改逻辑）
⚠️ 强制规则
Agent不能自己调用AI
所有AI调用必须经过 Agent00（AI Orchestrator）
3.1 Agent00 - AI Orchestrator（系统大脑）
职责：
控制所有Agent执行顺序
控制AI调用
控制Token预算
控制缓存
控制优先级
输入：
系统任务队列
输出：
执行指令
3.2 Agent01 - Design Signal Finder
职责：

发现餐饮设计/装修/项目信号

数据源：
Google
LinkedIn
Instagram
Behance
ArchDaily
输出：
Project Signal List
3.3 Agent02 - Project Extractor
职责：

提取结构化项目数据

输入：
文本 / 网页 / 社媒内容
输出：
Project + Company + Stage
3.4 Agent03 - Owner Finder
职责：

寻找甲方/品牌/决策人

输出：
Owner info
Contact info
Social accounts
3.5 Agent04 - Opportunity Scorer
职责：

判断是否值得做

评分规则：
S：设计初期 + 有预算
A：设计阶段
B：施工阶段
C：即将开业
D：已开业
3.6 Agent05 - Solution Matcher
职责：

匹配供应链解决方案

输出：

furniture package
booth seating
bar counter
modular system
estimated cost
3.7 Agent06 - Message Generator
职责：

生成沟通内容

输出：

Email
LinkedIn DM
Instagram DM
WhatsApp message
4. 工作流（不可更改）
Signal Found
↓
Project Extracted
↓
Owner Found
↓
Opportunity Scored
↓
Solution Generated
↓
Message Generated
↓
Human Review Required
↓
Send Message (Manual only)
↓
Update Status
5. AI调用规则（核心成本控制）
5.1 强制规则

Codex必须实现：

❌ 不允许AI调用的情况
数据过滤
分类
去重
格式化
搜索结果整理
✅ 允许AI调用的情况
商机判断
项目分析
文案生成
方案生成
BOM生成
5.2 AI Gateway规则

所有AI必须经过：

AI Gateway → 判断是否需要AI → 调用 → 缓存 → 返回
6. 缓存规则（强制）

Codex必须实现：

Cache Key：
project_id
company_id
content_hash
命中缓存：

直接返回，不允许调用AI

7. 人工控制规则（绝对禁止自动化）

以下操作必须人工确认：

发邮件
发LinkedIn消息
发WhatsApp
发报价
发PI/BOM
8. 系统目标（Codex不得修改）

系统目标不是：

自动获客系统 ❌

而是：

AI辅助商业机会识别与方案生成系统

最终人负责成交。

9. Codex开发原则

Codex只允许做两件事：

1. 实现系统结构
API
数据库
UI
Workflow
2. 修Bug + 优化性能
不允许改变商业逻辑
不允许修改Agent定义
不允许改变流程顺序
10. 系统核心原则总结
Rule First
AI Second
Human Approval Always
Opportunity Driven
Project Based Thinking