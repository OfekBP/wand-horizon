# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary users, weighted equally (confirmed), plus one supporting role.

- **Executive** (for example a COO): runs a hybrid workforce of 50 people and 500 AI workers. Needs to see what is blocked, in conflict, or has unproven value, and to act (reassign a pending decision, resolve a conflict).
- **Investigator** (financial services compliance): must establish what an AI worker was authorized to do when it attempted a consequential operation, even if its permissions changed afterwards, and be able to show why the action was allowed or prevented.
- **Manager** (supporting): changes an AI worker's permissions, sometimes while an operation is in progress.

Desktop-first. Used on a laptop or large monitor, in focused work sessions and in demos.

## Product Purpose

One product with two connected missions:

1. **Operate:** a unified command center for the hybrid workforce: verified business value, operating cost, ownership and accountability, conflicts, blocked operations, and permissions.
2. **Assure:** AI governance and historical authorization: reconstruct exactly what a worker was authorized to do at execution time, trace the authorization decision, and prove why an action was allowed or prevented.

Success means a user can move from spotting an operational problem to understanding its cause and inspecting the governance evidence without leaving the product.

## Positioning

The same operation is both a management object and an evidence object. A neighboring dashboard cannot truthfully copy this: every authorization decision is stored at execution time with the permission-change events it relied on, so history is never recomputed from today's permissions, and a replay check proves the stored decision.

## Operating Context

Synthetic local data only: 50 humans and 500 AI workers, trailing 30-day window with a fixed anchor (Oct 26, 2026 14:00 UTC). In-memory state with a Reset demo action. Built for a time-boxed builder challenge for Wand AI and to be explained and defended in an interview. Prototype policy: authorization must be valid at the moment a consequential action executes; revocation before execution prevents the action.

## Capabilities and Constraints

- Four screens: Overview, Work Queue, Workforce, Governance.
- Core workflows: reassign a pending human decision (status stays awaiting approval, owner changes, audit event recorded); resolve a conflict between two workers; change an AI worker's permissions while an operation is in progress and run its execution step; reconstruct historical permissions and event sequence for an operation.
- Operation statuses are exactly `in_progress`, `awaiting_approval`, `executed`, `prevented`. "Blocked" is derived from `awaiting_approval`.
- Event ordering is by global `seq`; timestamps are display-only. Events are append-only.
- Verified, estimated and unmeasured value are always shown separately and never summed. No ROI, savings or profit claims. No trend lines: value is a 30-day aggregate.
- No backend, real authentication, real model calls, or unnecessary dependencies. React, TypeScript and Vite.
- The "Acting as" role selector is simulated: it sets the actor in audit events and is not authentication or authorization.
- This is a browser simulation and must not claim production-grade security.
- Undecided: the product name. "Accord" is a working name and may change.

## Brand Commitments

None binding. Proposed and replaceable: the working name "Accord", the line "Run the hybrid workforce. Prove what it was allowed to do.", and an original mark of an overlapping circle (people) and rounded square (AI workers) with the overlap in the accent color. Wand's own logo, assets and layouts must not be copied; the broader visual direction of wand.ai (editorial type, warm stone and deep night chapters, violet accent) is inspiration only.

## Evidence on Hand

Synthetic fixtures generated deterministically in `src/data/generate.ts`; 31 passing tests; no real customers, testimonials, benchmarks or pricing exist and none may be invented.

## Product Principles

1. One case, two lenses: every operational issue links to its governance evidence, and every piece of evidence links back to its operational context.
2. Stored decisions are the evidence: history is read from what was recorded at execution time, never recomputed from current permissions.
3. Honest numbers: only metrics the data supports; separate what is verified from what is estimated or unmeasured.
4. Actionable before exhaustive: surface what needs a decision, not raw agent activity.
5. Say what it is: a simulation that demonstrates a policy and an audit design, not a security product.

## Accessibility & Inclusion

No product-specific standard was stated. Working target: WCAG 2.2 AA for text contrast and focus visibility, keyboard-operable flows, and reduced-motion support. Meaning is never carried by color alone (value basis also uses fill pattern).
