
# Restaurant Setup Pro - AI Execution Contract V1.0

This document defines STRICT execution rules for Codex.

It overrides any implicit behavior from AI models.

It is NOT a design document.

It is an execution control contract.

---

# 1. CORE PRINCIPLE (NON-NEGOTIABLE)

Codex is NOT allowed to design the system.

Codex is ONLY allowed to implement what is explicitly defined in:

AI_AGENT_SPEC_V1.md

Any deviation is a violation.

---

# 2. SYSTEM IMMUTABILITY RULES

The following elements are STRICTLY IMMUTABLE:

## 2.1 Agent Definitions

- Agent00 to Agent06 roles are FINAL
- No modification allowed
- No merging allowed
- No splitting allowed
- No renaming allowed

---

## 2.2 Workflow Order (STRICT SEQUENCE)

Signal → Extract → Owner → Score → Match → Message → Human Review → Send → Update

No skipping steps.

No reordering.

No parallel bypassing.

---

## 2.3 Data Models (FINAL SCHEMA)

The following tables are FINAL:

- Project
- Company
- Contact
- Opportunity
- Message

Codex must NOT:

- Add new core business entities
- Remove existing entities
- Merge entities
- Change schema structure

---

# 3. AI USAGE CONTROL RULES

## 3.1 AI Gateway Enforcement

ALL AI calls MUST go through:

Agent00 → AI Gateway → Model → Response

Direct AI calls from any agent are STRICTLY FORBIDDEN.

---

## 3.2 Allowed AI Usage

AI can ONLY be used for:

- Opportunity scoring
- Project analysis
- Message generation
- Solution matching
- BOM / PI generation

---

## 3.3 Forbidden AI Usage

AI MUST NOT be used for:

- Data filtering
- Keyword matching
- Deduplication
- Simple classification
- Parsing structured data
- Sorting or grouping data

These must be handled by rule-based logic.

---

# 4. AGENT BEHAVIOR RULES

## 4.1 Agent Independence Rule

Each Agent:

- MUST perform only its defined function
- MUST NOT call other agents directly
- MUST NOT modify data from other agents

All coordination must go through Agent00.

---

## 4.2 Agent00 Authority Rule

Agent00 is the ONLY system component allowed to:

- Schedule agent execution
- Trigger AI calls
- Manage AI budget
- Apply cache logic
- Control workflow execution

No other agent has orchestration authority.

---

# 5. WORKFLOW ENFORCEMENT

The system MUST strictly follow:

Signal → Extract → Owner → Score → Match → Message → Human Review

Any deviation is invalid.

---

# 6. HUMAN APPROVAL RULE

The following actions REQUIRE human approval:

- Sending emails
- Sending LinkedIn messages
- Sending WhatsApp messages
- Sending Instagram messages
- Sending quotations
- Sending PI/BOM
- Sending any commercial proposal

AI output is recommendation only.

---

# 7. AI COST CONTROL RULES

## 7.1 AI Gateway Mandatory Check

Before any AI call:

1. Check rule-based execution possibility
2. Check cache
3. Check budget
4. Only then allow AI call

---

## 7.2 Cache Rule (MANDATORY)

If identical input exists in cache:

- Return cached result
- DO NOT call AI again

---

# 8. CODEx DEVELOPMENT BOUNDARY

Codex is ONLY allowed to:

- Implement backend logic
- Implement database structure
- Implement frontend UI
- Implement APIs
- Implement Agent execution engine

Codex is NOT allowed to:

- Modify business logic
- Modify agent definitions
- Modify workflow order
- Introduce new business entities
- Reinterpret system design

---

# 9. SYSTEM DESIGN AUTHORITY

Final authority belongs to:

AI_AGENT_SPEC_V1.md

This contract only enforces execution.

It does NOT define business logic.

---

# 10. FAILURE HANDLING RULE

If any conflict exists between:

- Code behavior
- This contract
- AI model suggestion

This contract ALWAYS wins.

System must stop execution and request human review.

---

# END OF CONTRACT

This document is binding for all Codex execution layers.