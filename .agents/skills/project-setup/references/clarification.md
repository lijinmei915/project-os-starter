# CLARIFICATION FLOW

## Purpose

Use this reference when the user expresses a vague product or project intent.

Examples:

- 我想做一个产品
- 我有个产品想法
- 我想做个东西
- 帮我规划一个产品
- I want to build a product
- I have an idea

中文说明：
当用户只说“产品”“想法”“东西”，但没有明确是软件系统、产品方案、页面原型还是代码实现时，先用本流程澄清。

---

## Principle

Do not depend on external clarification skills.

Project OS handles minimal clarification internally.

中文说明：
不要依赖外部澄清 skill。
Project OS 自己完成最小澄清。

---

## Trigger Conditions

Use CLARIFICATION only when at least one condition is true:

- no meaningful current intent can be extracted, such as `1234567`
- multiple current actions conflict and priority is unclear
- the message contains only future possibilities but no current action
- constraints conflict with the requested action
- confidence is low after combining user language and directory evidence

Do not clarify again when the user already provided a clear current action such as:

- 先做登录页
- 帮我把项目跑起来
- 帮我看看，不要改
- 做一个最小 Skill

中文说明：
澄清是低置信度兜底，不是每个项目请求的固定表单。
用户已经说清当前动作时，直接路由并推荐最小下一步。

## Clarification Output Contract

Before asking, internally summarize:

```json
{
  "understood": [],
  "conflicts": [],
  "missing": [],
  "question": "",
  "confidence": "low"
}
```

Ask exactly one question that resolves the highest-impact missing field.

Examples:

```txt
输入：1234567
输出：我还没识别出你想推进的目标。你现在是想创建新项目、接手已有项目，还是只讨论产品方案？
```

```txt
输入：以后想接 AI，现在先把页面和部署都做了
输出：我识别到页面和部署两个当前目标。你希望先完成可见页面，还是先跑通部署？
```

---

## Required Question

For the v1 compatibility case “我想做一个产品”, the first response MUST identify this as CLARIFICATION and ask one short clarification:

```txt
这是一个模糊产品请求。我先确认一下：

1. 你是想做软件系统，还是产品方案？
2. 如果是软件系统，是想快速出原型，还是先建项目基础？
```

English version:

```txt
This is a broad product request. Let me clarify:

1. Do you mean a software system or a product strategy?
2. If it is software, do you want a quick prototype or project foundation first?
```

---

## Routing After Clarification

- Software system / app / website / dashboard / page -> INIT
- Existing project / repo / codebase -> HYBRID
- Review / analyze only -> AUDIT
- Product strategy only -> stay in project-setup and produce planning output, without generating code

中文说明：
澄清后再进入 INIT / HYBRID / AUDIT。
如果只是产品方案，不生成代码，仍留在 project-setup 输出规划。

---

## Hard Rules

- MUST ask exactly one clarification question per clarification turn.
- MUST include `CLARIFICATION` intent in the response when possible.
- MUST NOT generate files before intent is clear.
- MUST NOT route to frontend before software intent is confirmed.
- MUST NOT assume every product request is software.
- MUST summarize what is already understood before asking when meaningful evidence exists.
- MUST NOT ask the fixed compatibility question when a more specific missing field is known.

## Anti-Patterns

Do NOT answer vague product requests with only:

```txt
什么产品？说说想法。
```

中文说明：
这种回答太泛，会绕过 Project OS 的内部澄清分流。
