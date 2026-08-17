---
id: "01M07525BSMR548PD8FB9BSRW4"
cta_label: "Tell us your case"
# evidence traceability in issue 270 and docs/company/04-services-business-model.md
---

We use AI in two ways. As a tool, to build with more quality and fewer hours what we already knew how to build. And as a system component, to solve what was not possible until recently. Either way it is a means, not an end.

When code gets cheap to generate, far more software gets generated ([Jevons paradox](https://news.northeastern.edu/2025/02/07/jevons-paradox-ai-future/)). And all that new software must be [integrated](/en/systems-integration) and [secured](/en/cdn-waf-edge-security-cloudflare) inside systems that already exist. That is the most valuable part of the work, and the part we have done since 2019.

The repetitive code goes to the machine. Our time goes to judgment and accountability, and a small team now ships what used to take a large one.

## Generated ≠ shipped

An agent is AI that does things, not just answers. To be useful it needs to read the order in [`SAP`](/en/e-commerce), check stock in [`BigQuery`](/en/big-data-cloud-analytics) and write the result where your team actually works. That wiring is our home ground.

Our workflow is this very pull request. The agent proposes; the engineer reviews, approves and **signs**. Always with minimal permissions, every action logged.

- **Agents with bounded permissions.** Built on the [`Agents SDK`](https://developers.cloudflare.com/agents/), they touch only what they must, and a person can always stop them.
- **Inference at the edge.** Document classification and extraction with [`Workers AI`](https://developers.cloudflare.com/workers-ai/), on the [`Cloudflare`](https://www.cloudflare.com/) network. The data is processed in your own account, not in a third-party AI `SaaS`.
- **Governed AI traffic.** Every model call logged and cost-capped in [`AI Gateway`](https://developers.cloudflare.com/ai-gateway/). You will know which model answered and what it cost.
- **Audit before production.** Security, business logic and performance. No generated line ships without passing it.

## We sign the code

We use AI every day. [`Claude Code`](https://claude.com/claude-code), [`Cursor`](https://cursor.com), open models on `Workers AI`. Using it is how we know where it fails.

The industry's most repeated complaint is code that is almost right, but not quite. On a promotion calculation or a stock feed, "almost" is an incident.

So we lead with security. Agents run on least-privilege credentials, work in environments separated from production, and nothing reaches `main` without human review.

Whoever signs, answers. From August 2026, the [EU AI Act](https://artificialintelligenceact.eu/) also demands human oversight with the competence and authority to override or halt a high-risk system. That is already how we work.

You won't find an AI product here. We don't have one, and we don't pretend to. What we have is a method made of versioned rules and protocols that steer the agents, distributable and auditable.

[This very website](/en/deconstructing) is built that way, by supervised agents, pull request by pull request. And if a chatbot won't solve anything for you, we'll tell you not to build one.

> [**One team**](/en/about-us)**. Six verticals. Zero handoffs.**
