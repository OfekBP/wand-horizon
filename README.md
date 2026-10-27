# Accord

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

## Seeing the company: the Workforce Map

The Workforce screen opens on a map of the whole organization (the registry table is the other tab). The executive sits at the top with reporting lines to the head of each team. Each team is a region, and each person who owns AI workers is a **pod**: the person with their accountable AI workers as dots. AI workers use the product's value encoding: solid = verified, hatched = estimated, outlined = unmeasured.

**Findings drive the map.** A ranked list ("What the map found") is derived from live data. Selecting one zooms the map to the cluster, switches to the lens that explains it, and opens a situation panel with *why it matters*, *how we got here* (a clickable cause chain), and *decide* (a real action). Resolving it writes an audit event, changes the underlying data, and the finding, the drawing and the Work Queue all update. Nothing is a UI-only flag.

| Finding | What the evaluator sees | Action |
| --- | --- | --- |
| Blocked decision | *Release settlement batch SB-2291* ($2.4M) is blocked because its decision owner, Elena Park, is out of office with no delegate, and the custodian cut-off is in 20 hours | Move the decision to an available person. The operation stays *awaiting approval*; the finding clears; an owner-change event is logged. A person who is also out of office is refused. |
| Conflicting objectives | Two missions (*Pay suppliers early* and *Minimize idle cash*) fight over one liquidity buffer | Choose the authoritative worker; the conflict closes everywhere |
| Duplicated work | Two workers independently doing the same work | Choose which keeps it |
| Cost without verified value | *Clear the Q4 claims backlog*: 14 workers whose **simulated** cost rose 74% with none verified | Pause the workers. The modeled run-rate falls, they are drawn as paused, one event is logged |
| Authority at risk | An in-flight operation that would be denied if it ran now | Restore the permission, or open the evidence |

Lenses (Ownership, Value and cost, Conflicts, Blocked, Authority, Missions) change what the map emphasizes. Every screen links in and out: the Overview, the Work Queue drawer and the Governance case page all open the same situation on the map, with a Back link.

**About the cost comparison.** There is no time series and none is invented. Each AI worker has a *simulated* previous-30-day run cost from the same cost model as its current cost. The comparison is always labeled simulated, is never presented as a measurement, and is never used for a return or savings claim.

## Proving what was authorized: the Incident replay

Open any Governance case with authority history (start with the **Featured incident**, *Wire $120,000 to Northwind Escrow*). The replay shows three lanes in order of record, not to time scale: the AI worker, the people who changed things, and the stored authorization record. Move the playhead (or press Play) and the page rebuilds, from the stored events, what the worker was **authorized to do then**, beside what is **permitted now**. Hatched bands mark where the authority at that point differs from today. A sentence narrates each step from the record, and the accountability strip shows who recorded it, the worker's owner, the decision owner at that point, and who last set the authority. The stored decision never changes as the playhead moves.

## Other flows to try

| Flow | Where | What to do |
| --- | --- | --- |
| Reassign a blocked decision | Map → the blocked finding (or Work Queue → *SB-2291*) | Move the decision to an available person |
| Resolve a conflict | Map → a conflict finding (or Work Queue → Conflicts) | Choose the authoritative worker and write a note |
| Change permissions mid-flight | Map → *Payments-Disburse-003* → **Change permissions** | Revoke the wire permission (or lower the limit below $480,000), then Governance → *Wire $480,000 to Halden Freight* → **Run execution step**. Execution is prevented; without the change it is allowed |
| Reconstruct history | Governance → *Replay the incident* | Scrub the replay; also try *Wire $75,000 to Kestrel Logistics* (executed, revoked afterwards) and *Approve payout for claim CL-68801* (limit lowered) |
Use the **Acting as** selector to record actions as an Executive, Manager or Investigator. It is simulated: it only sets the actor name in audit events and is not authentication or authorization.

## Architecture

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
