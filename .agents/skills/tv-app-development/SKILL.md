---
name: tv-app-development
description: Orchestrate end-to-end hosted React TV app development across Samsung, LG, Hisense, Xbox, and PS5 using specialized sub-skills. Use when requests span multiple TV concerns such as focus architecture, remote/gamepad input, back-stack behavior, search UX, auth/session recovery, data robustness, performance, and certification QA.
---

# TV App Development

## Overview
Route each request to the minimum set of TV sub-skills needed.
Prioritize deterministic focus behavior, Back correctness, and performance on real TV/console constraints.

## Available Sub-Skills
- `spatial-navigation-engineering`
- `input-abstraction-layer`
- `ten-foot-information-architecture`
- `tv-search-ux`
- `auth-session-resilience`
- `personalization-upsell-decisioning`
- `leanback-data-layer-robustness`
- `tv-performance-profiling`
- `certification-aware-qa`

## Mandatory Response Header
Every response must begin with a single first line in this exact format:
`Active Skills: <comma-separated-skill-names>`

Rules:
- Include `tv-app-development` plus each selected sub-skill.
- For single-skill routing, still include the same header format.
- Do not place any text above this line.

## Dispatch Workflow
1. Classify the user request by primary outcome.
2. Select one primary sub-skill and only required secondary sub-skills.
3. Execute in dependency order using the sequencing rules below.
4. Deliver implementation plus validation artifacts.
5. If behavior crosses screens or states, add certification-aware regression checks.

## Sequencing Rules
- Build in this order when creating new features:
1. `ten-foot-information-architecture`
2. `spatial-navigation-engineering`
3. `input-abstraction-layer`
4. Domain feature skill (`tv-search-ux`, `auth-session-resilience`, or `personalization-upsell-decisioning`)
5. `leanback-data-layer-robustness`
6. `tv-performance-profiling`
7. `certification-aware-qa`

- For bugfixes, start with the failing behavior's owning skill, then run:
1. `tv-performance-profiling` if latency/jank is involved
2. `certification-aware-qa` for regression containment

## Trigger Map
- Focus loss, trapped navigation, wrong directional moves:
Use `spatial-navigation-engineering`
- Keycode mismatches, repeated inputs, inconsistent Back/Menu events:
Use `input-abstraction-layer`
- Overcrowded layouts, distant readability issues, too many clicks:
Use `ten-foot-information-architecture`
- TV keyboard, IME, remote typing latency, suggestions/voice hooks:
Use `tv-search-ux`
- QR/device code login, token expiry loops, idle timeout recovery:
Use `auth-session-resilience`
- Remote-friendly upsell prompts, dismissal/revisit flows, funnel events:
Use `personalization-upsell-decisioning`
- Stalling rails, weak loading states, retry/backoff, focus-safe errors:
Use `leanback-data-layer-robustness`
- Slow startup, rail scroll jank, decode pressure, memory churn:
Use `tv-performance-profiling`
- Submission readiness, cross-platform edge-case coverage:
Use `certification-aware-qa`

## Non-Negotiable Product Rules
- Keep D-pad navigation deterministic per screen state.
- Enforce predictable Back behavior for modals, routes, and app exit.
- Preserve or safely recover focus after async updates and resume.
- Ensure every critical user flow is fully operable without pointer input.

## Output Contract
For multi-skill tasks, return:
1. Active skills header line.
2. Scope and selected sub-skills.
3. Ordered implementation plan.
4. Concrete code and config changes.
5. Validation evidence (tests, traces, or matrix rows).
6. Residual risks and next checks.

## References
- Use `references/dispatch-matrix.md` for request-to-skill mapping and default bundles.
