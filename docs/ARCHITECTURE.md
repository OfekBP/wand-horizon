# Wand Horizon: architecture, rules and decisions

The product README is in [../README.md](../README.md). This file holds the design of the domain model, the authorization and audit rules, the metric definitions, the decision log and the known limitations.

## Code layout

```
src/
  domain/    pure TypeScript, no React
    types.ts       entities and the AuditEvent union
    authorize.ts   permissionsAsOf(), authorize(), replayMatches()
    audit.ts       appendEvent() (the only place events are created) and event rendering text
    reducer.ts     applyAction(): the single pure state-transition function
    selectors.ts   metrics, queues, case rows, authority at risk, then-vs-now, scenario progress
    findings.ts    the ranked findings, their cause chains and reach (derived, never stored)
    orgLayout.ts   deterministic organization layout for the map (pods, regions, reporting lines)
  data/      seeded PRNG and fixtures; history is produced by replaying actions through the real reducer
  state/     store.tsx (state + act()), appContext.ts, nav.tsx + navContext.ts (System navigation), router.ts (the URL grammar)
  ui/        shell, primitives, audit timeline, and one folder per screen
  styles/    tokens.css (design tokens), base.css, components.css
tests/       domain, fixture and UI-flow tests
```

Data flows one way: UI → `act(action)` → `applyAction(state, action)` → new state → selectors → UI. The UI never mutates state, and no number on screen is stored: counts, totals and coverage are computed from the underlying records, so screens cannot disagree.

## Authorization and audit model

Policy: **authorization must be valid when a consequential action executes. Revocation before execution prevents the action.**

- Permissions are never stored as mutable state. They are folded from the append-only event log (`PermissionChanged` events).
- **Ordering is by `seq` only.** Every event has a global, strictly increasing sequence number. Timestamps are display-only and may tie. "State as of X" means events with `seq <= X`.
- Per worker and scope, folded in `seq` order: `grant(limit?)` activates it; `modify(limit)` changes the limit only if active; `revoke` deactivates it; a later `grant` starts fresh. Scopes match by exact string.
- Allowed when the scope is active at the cutoff and the amount is within the limit. Reason codes: `ACTIVE_GRANT`, `NO_GRANT`, `REVOKED`, `LIMIT_EXCEEDED`.
- Every execution attempt records an `AuthorizationEvaluated` event with the operation, worker, scope, amount, decision, reason, timestamp, `cutoffSeq`, the resolved scope state, and the ordered ids of the permission events it relied on. It is followed by `OperationExecuted` or `ExecutionPrevented`.
- Events are never edited or deleted. Later permission changes only add events and never change an earlier decision or outcome. The history view shows the stored decision, and a **replay check** recomputes it from the log to verify it.

### Operation statuses

`in_progress`, `awaiting_approval`, `executed`, `prevented`. "Blocked" is derived: an operation is blocked exactly when it is `awaiting_approval`.

- Reassigning a decision changes the owner only; the status stays `awaiting_approval`. The new owner must be available (out-of-office people are refused).
- Pausing AI workers is a leadership control recorded as one `WorkersPaused` event; paused workers are not active (they leave coverage and the run-rate) and cannot execute.
- Only `in_progress` operations can be executed. The UI hides the action for other statuses and the reducer rejects it.
- The prototype does not simulate the human approval step; it shows permission changes ahead of an execution attempt.

## Metric definitions (trailing 30 days, fixed anchor Oct 26, 2026 14:00 UTC)

Value records attach to AI workers only. Each active AI worker is in exactly one class: **verified** (at least one verified record), **estimated only**, or **unmeasured** (no records).

- **Verified value:** sum of value records confirmed in a system of record.
- **Estimated value:** sum of model-based records. Always shown separately and never added to verified value.
- **Unmeasured AI workers:** count with no value records. No dollar figure is assigned.
- **Verified coverage:** active AI workers with at least one verified record ÷ all active AI workers. A count of workers, not dollar-weighted.
- **AI operating cost** and **Human labor cost:** modeled monthly cost and synthetic loaded labor cost, reported separately and never blended.

**Return on cost** (added later): verified value ÷ modeled monthly cost for active AI workers, trailing 30 days (`src/domain/roi.ts`). Estimated value is carried beside it and never counted. Thresholds live in one constant, `ROI_POLICY` (green at 3× or more, red under 1×); a worker with no verified value is amber when it has estimates, red when its cost is rising 25% or more, and grey when it has no value data at all. People have no return of their own; a person's figure is the roll-up of the AI workers they are accountable for. The data is synthetic and the thresholds are a policy choice, not a measurement. No savings or profit is calculated.

## Decision log

| Decision | Why |
| --- | --- |
| React + TypeScript + Vite, two runtime dependencies | Small, fast, easy to explain. No router, state library, UI kit or chart library: each would add more to defend than it saves for this scope. |
| Pure `domain/` layer with one reducer | Authorization and audit rules are testable without a browser, and every state change passes through one place that also writes the audit event. |
| Permissions folded from an event log | History is correct by construction; there is no "current permissions" field that can drift from what happened. |
| `seq` for ordering, timestamps for display | Timestamps can tie or be skewed; a monotonic sequence gives a total order that makes reconstruction deterministic. |
| Fixtures replay real actions through the reducer | Seeded history, decisions and evidence are consistent with the live logic by construction, not hand-written. |
| Hash-based navigation | Deep links and refresh work with no router dependency. |
| In-memory state with Reset demo | Impossible to get stuck in a corrupted state; trade-off is losing changes on refresh. |
| Hand-built CSS with design tokens | Full control of the visual language and a tiny bundle. Colour is reserved for meaning: accent for interaction and verified value, red and amber for severity only. |
| Findings are derived, never stored | A finding disappears because the data stopped matching it (a decision moved, a conflict closed), so the map, the list and the queue cannot disagree. |
| Deterministic pod layout, not a force graph | 550 nodes in a force simulation is a hairball and changes every load. Pods make ownership the shape of the picture and keep the layout testable. |
| Cost rise shown only as a labeled simulated comparison | There is no time series, so none is invented; the comparison never leaves the finding and is never used for a return claim. |
| Verified = solid, estimated = hatched, unmeasured = outlined | The distinction survives every chart, badge and legend and works without relying on colour alone. |

## Known limitations

- Single-user simulation. The acting-as selector is not access control.
- No approval workflow, no real execution, no persistence.
- Performance concerns are read-only (investigate and open the worker profile; no acknowledge action).
- The map shows 550 nodes at overview scale where labels are small; use the findings list, a lens, or zoom (select a team or finding) to read it. Individual AI dots are mouse-targets only; the registry and findings list are the keyboard and screen-reader equivalents.
- Missions, availability and the previous-period cost are synthetic fixtures written for the demo.
- The incident replay orders events by sequence, not to time scale, by design.
- Authorization scopes are exact strings with a single amount limit per scope.
