# Workforce Command

A desktop-first prototype for managing a hybrid workforce of 50 people and 500 AI workers. It answers two questions:

1. **Leadership:** what is the verified business value, what does it cost to operate, and what is blocked or in conflict right now?
2. **Financial services:** what was an AI worker authorized to do at the moment a consequential action ran, even when its permissions changed mid-flight?

All data is synthetic and runs in the browser. There is no backend, database, authentication or AI inference.

> **Browser simulation.** The authorization logic demonstrates a policy and an audit design. It does not provide production-grade security.

## Run it

Requires Node 20+ (developed on Node 24).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # domain tests + UI flow tests
npm run build    # typecheck + production build
```

Use **Reset demo** (bottom of the sidebar) to restore the original data. State is in memory only, so a refresh also resets it.

## The four flows to try

| Flow | Where | What to do |
| --- | --- | --- |
| A. Reassign a blocked decision | Work Queue → open *Release settlement batch SB-2291* | **Reassign decision**, pick a person, give a reason. The owner changes, the status stays *Awaiting approval*, and an audit event is recorded. |
| B. Resolve a conflict | Work Queue → *Conflicts* → *Intraday liquidity buffer* | Choose the authoritative worker and write a note. The conflict leaves the open list and a `ConflictResolved` event is recorded. |
| C. Change permissions mid-flight | Workforce → *Payments-Disburse-003* → **Change permissions** | Revoke the wire permission (or lower the limit below $480,000). Then open Governance → *Wire $480,000 to Halden Freight* → **Run execution step**. Execution is prevented. Without the change it is allowed. |
| D. Reconstruct history | Governance → any operation; try *Wire $120,000 to Northwind Escrow*, *Wire $75,000 to Kestrel Logistics*, *Approve payout for claim CL-68801* | Select events in the sequence. The right panel rebuilds the permission state as of that event and shows the stored decision, its evidence, and a replay check. |

Use the **Acting as** selector to record actions as an Executive, Manager or Investigator. It is simulated: it only sets the actor name in audit events and is not authentication or authorization.

## Architecture

```
src/
  domain/    pure TypeScript, no React
    types.ts       entities and the AuditEvent union
    authorize.ts   permissionsAsOf(), authorize(), replayMatches()
    audit.ts       appendEvent() (the only place events are created) and event rendering text
    reducer.ts     applyAction(): the single pure state-transition function
    selectors.ts   metrics, queues, timelines (all UI numbers are derived here)
  data/      seeded PRNG and fixtures; history is produced by replaying actions through the real reducer
  state/     store.tsx (state + act()), nav.tsx (hash-based navigation, toast)
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

- Reassigning a decision changes the owner only; the status stays `awaiting_approval`.
- Only `in_progress` operations can be executed. The UI hides the action for other statuses and the reducer rejects it.
- The prototype does not simulate the human approval step; it shows permission changes ahead of an execution attempt.

## Metric definitions (trailing 30 days, fixed anchor Oct 26, 2026 14:00 UTC)

Value records attach to AI workers only. Each active AI worker is in exactly one class: **verified** (at least one verified record), **estimated only**, or **unmeasured** (no records).

- **Verified value:** sum of value records confirmed in a system of record.
- **Estimated value:** sum of model-based records. Always shown separately and never added to verified value.
- **Unmeasured AI workers:** count with no value records. No dollar figure is assigned.
- **Verified coverage:** active AI workers with at least one verified record ÷ all active AI workers. A count of workers, not dollar-weighted.
- **AI operating cost** and **Human labor cost:** modeled monthly cost and synthetic loaded labor cost, reported separately and never blended.

No return on investment, savings or profit is calculated anywhere.

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
| Verified = solid, estimated = hatched, unmeasured = outlined | The distinction survives every chart, badge and legend and works without relying on colour alone. |

## Known limitations

- Single-user simulation. The acting-as selector is not access control.
- No approval workflow, no real execution, no persistence.
- Performance concerns are read-only (investigate and open the worker profile; no acknowledge action).
- Authorization scopes are exact strings with a single amount limit per scope.
