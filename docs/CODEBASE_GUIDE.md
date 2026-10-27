# Wand Horizon: the whole codebase explained from zero

You do not need to know programming to follow this. Read it in order once; after that use it as a map. When a section says **"Show it"**, open that file in the editor so you can point at it in a live conversation. The companion file [DEFENSE_QA.md](DEFENSE_QA.md) has the 37 questions a tester can ask, with short answers.

Contents
1. What the product is, in plain words
2. Ten ideas about web apps you need first
3. **Where the data lives and how it works** (your question)
4. The folder map, file by file
5. Following one click all the way through
6. The authorization and audit engine (Mission 2)
7. Findings and metrics (Mission 1)
8. The map
9. Navigation and the URL
10. The screens and the design system
11. Landing page, demo player, brand film, email
12. Tests, build, deploy
13. Glossary
14. Beginner questions and answers

---

## 1. What the product is, in plain words

A company has 50 people and 500 AI workers. Two things go wrong:
1. **Nobody can see the whole picture:** who owns which AI worker, what is stuck, what is in conflict, whether the AI spending is paying off.
2. **When an AI worker does something consequential (say, sends a $120,000 wire), nobody can prove afterwards what it was allowed to do at that exact moment**, especially if its permissions changed while the work was in progress.

Wand Horizon is a working prototype that answers both. It is a website you open in a browser. It has no server behind it. It runs entirely inside the visitor's browser tab, on made-up (synthetic) data.

## 2. Ten ideas about web apps you need first

1. **A website is files.** The browser downloads HTML (structure), CSS (looks) and JavaScript (behaviour). Our project is written in **TypeScript** (JavaScript plus checks that catch mistakes) and **React** (a library for building screens from small reusable pieces called **components**). A tool called **Vite** turns our source files into the plain files the browser understands (`npm run build`).
2. **The browser runs the JavaScript.** There is no computer of ours involved after the files are downloaded. That is what "static site" means. Ours is hosted on Vercel, which only hands out the files.
3. **Variables live in memory (RAM).** When JavaScript runs, its data sits in the browser tab's memory. Close or refresh the tab and that memory is wiped. This is the key to your data question.
4. **State** means "the data the screen is currently showing". In React, when state changes, React redraws only the parts of the screen that depend on it.
5. **A component** is a function that returns a piece of screen. `Overview` is the Start here page; `Button` is one button. Components use other components.
6. **A "pure function"** always returns the same output for the same input and changes nothing else. Our rules are pure functions. That makes them predictable and testable.
7. **A "reducer"** is a pure function `(oldState, action) → newState`. It is the only place our data is allowed to change. `applyAction` in `src/domain/reducer.ts` is ours.
8. **An "event log"** is a list where you only ever add new entries, never edit or delete old ones, like a bank statement. Our audit trail is one.
9. **A "hash URL"** is the part after `#` (e.g. `…/#/governance/op-d1`). Changing it does not reload the page, so the app can read it and show the right screen. That makes links and refresh work without a server.
10. **A "test"** is a small program that checks our code does what we claim. We have 130, and they run automatically on GitHub.

---

## 3. Where the data lives and how it works

### The short answer
The data is **one big JavaScript object in the browser tab's memory**. It is created when the page opens, changed while you use the app, and **thrown away when you refresh or close the tab**. It is never written to a database, a file, or a server. The next visit creates it again, identical.

Think of it like a spreadsheet that opens already filled in, that you can edit, but that has no "Save" button, so the file on disk never changes.

### The three places that matter, and what each does

```
  SOURCE CODE (files on disk / GitHub)         BROWSER TAB MEMORY (while the page is open)
  ───────────────────────────────────          ─────────────────────────────────────────
  src/data/generate.ts  ──── runs once ───▶    state  (the big object, called AppState)
  "recipe" to make the data                      ├─ teams[]      8 teams
                                                  ├─ workers[]    550 people and AI workers
  src/domain/types.ts                             ├─ missions[]   9 missions
  describes the SHAPE of the data                 ├─ values[]     value records
                                                  ├─ operations[] 106 pieces of work
  src/state/store.tsx                             ├─ conflicts[]  7 conflicts
  holds `state` and lets screens read it          ├─ events[]     340 audit events (the log)
  and request changes                             └─ clock, nextSeq, actingAs …
```

1. **The shape** (`src/domain/types.ts`). Defines what a worker, operation, event and the whole `AppState` look like. This file stores no data; it is the blueprint.
2. **The recipe** (`src/data/generate.ts`, function `createInitialState()`). When the app starts, this builds the starting data:
   - 8 teams, 50 people, 500 AI workers: generated from tables of names and roles plus a **seeded random generator** (`src/data/prng.ts`). "Seeded" means the randomness is repeatable: the same seed always gives the same numbers, so every visitor sees identical data.
   - A fixed "now": 26 Oct 2026, 14:00 UTC, so dates never drift.
   - Hand-written hero scenarios (the blocked $2.4M settlement, the wire whose permission was revoked).
   - **The history is not typed in.** The generator *performs* scripted actions ("grant this permission on 16 Sep", "start this wire", "revoke it", "attempt it") by running them through the real reducer. Every event, its sequence number and every authorization decision are produced by the same rules the live app uses, so the history cannot contradict the logic.
3. **The holder** (`src/state/store.tsx`, component `AppProvider`). It calls `createInitialState()` once and keeps the result in React state (`useState`). Every screen reads it through a hook, `useApp()`, and changes it only by calling `act(action)`.

### What the data looks like (real shapes)

A **worker** (person or AI):
```
{ id, kind: 'ai' | 'human', name: 'Payments-Disburse-003', role, teamId,
  status: 'active' | 'paused', ownerId /* the accountable person */,
  responsibilities: [...], monthlyCost, priorMonthlyCost /* simulated */, missionId }
```
An **operation** (a piece of work, e.g. a wire):
```
{ id: 'op-c1', title: 'Wire $480,000 to Halden Freight Ltd', workerId /* the AI doing it */,
  decisionOwnerId /* the human approver */, status: 'in_progress',
  amount: 480000, requiredScope: 'payments:wire:execute', startedAt, severity, ... }
```
An **audit event** (one line of the log):
```
{ id: 'ev-18', seq: 18, at: '2026-09-16T14:01Z', actor: 'Policy Admin',
  type: 'PermissionChanged', workerId, scope: 'payments:wire:execute',
  action: 'grant', limit: 500000, reason: 'Standard role provisioning' }
```
There are eight event types: `OperationStarted`, `PermissionChanged`, `AuthorizationEvaluated`, `OperationExecuted`, `ExecutionPrevented`, `OwnerReassigned`, `ConflictResolved`, `WorkersPaused`.

### What changes it
Only one function: `applyAction(state, action)` in `src/domain/reducer.ts`. It takes the current state and an action (e.g. "reassign this decision to Ingrid") and returns **a brand-new state** (it never edits the old one). Six actions exist: `START_OPERATION`, `CHANGE_PERMISSION`, `ATTEMPT_EXECUTION`, `REASSIGN_OWNER`, `RESOLVE_CONFLICT`, `PAUSE_WORKERS`. Each validates the request (it can say no) and appends an audit event.

### What is *not* stored in `state` on purpose
Nothing like "current permissions", "number of issues", "open findings" or "total cost" is stored. Those are **calculated from the records every time** by functions in `selectors.ts` and `findings.ts`. Result: two screens can never show different numbers, and nothing can drift out of date.

### What survives a refresh?
Nothing, except two tiny interface flags in the browser's own storage: `localStorage` remembers you dismissed the "New here?" strip; `sessionStorage` remembers the map already auto-opened. No cookies. The app never contacts a server for data (there is no `fetch` anywhere).

### Why we chose this
The challenge is about showing how visibility and accountability work, not about running infrastructure. A backend would add accounts, hosting, security and failure modes that prove nothing extra. In memory + deterministic seed gives: instant start, identical demo every time, impossible to corrupt, free to host. The cost is honest and stated: no persistence and a single user. In production, the event log would be an insert-only database table and the same reducer rules would run on a server.

---

## 4. The folder map, file by file

```
index.html               the one page; has <div id="root"> where React draws everything
public/                  files served as-is: logo PNG, favicon, self-hosted fonts
src/
  main.tsx               starts React and draws <Root/> into #root
  Root.tsx               picks which "site" page to show from the URL; lazy-loads big ones
  App.tsx                the System: wraps everything in the data holder, navigation, shell
  config/site.ts         site settings: GitHub URL, name, tagline, credit line
  domain/                THE BRAIN. Pure TypeScript, no screens
    types.ts             shapes of all data
    reducer.ts           applyAction: the only way data changes; the 8 permission scopes
    authorize.ts         rebuild permissions from the log; decide allowed/denied
    audit.ts             builds events (appendEvent) and words them for humans
    selectors.ts         read-only questions: metrics, queues, cases, then-vs-now
    findings.ts          the ranked list of problems, cause chains, deadlines
    orgLayout.ts         computes where every dot goes on the map
    format.ts            money and date formatting
  data/
    prng.ts              seeded random generator and the fixed "now"
    generate.ts          builds the starting data (createInitialState)
  state/
    store.tsx, appContext.ts   holds the data; useApp()
    nav.tsx, navContext.ts     which System screen is open; back links; toasts; useNav()
    router.ts                  the URL grammar for the whole site
  styles/                tokens.css (all colours, sizes, radii), base, components, fonts
  ui/
    terms.ts             the labels the demo and tests rely on
    shell/               left rail + top bar around every System screen
    primitives/          small building blocks: Button, Badge, Card, Table, Overlay, Logo, Icon
    audit/               the event timeline used on case pages
    screens/
      Overview/          "Start here": the three questions
      WorkQueue/         "Needs attention": blocked ops, conflicts, concerns + drawers
      Workforce/         "Org map": map, findings list, registry, worker profile, permission dialog
      Governance/        "AI accountability": cases, incident replay, evidence
    landing/ site/       the public landing page and its shared header/footer
    demo/                the product demo player (script.ts is the storyboard)
    intro/               the 22-second brand film (film.ts drawing, score.ts sound)
tests/                   130 automated tests in 12 files
docs/                    architecture, Q&A, this guide, the email
.github/workflows/ci.yml runs checks on every push
```

**Rule to remember:** `domain/` knows nothing about screens; `ui/` never changes data directly. Screens ask (`act`), the domain decides.

---

## 5. Following one click all the way through

You are on Org map with the blocked $2.4M settlement open. You pick Ingrid Novak and click **Move the decision**.

1. `ui/screens/Workforce/map/FindingActions.tsx` (`BlockedActions`) runs its submit handler and calls `act({ type: 'REASSIGN_OWNER', operationId: 'op-a1', newOwnerId, reason })`.
2. `act` is in `state/store.tsx`. It adds two things the screen did not supply: the time (the simulated clock plus 2 minutes) and the actor (the name of the demo role). It then calls `applyAction(currentState, fullAction)`.
3. `applyAction` (`domain/reducer.ts`, case `REASSIGN_OWNER`) validates: the operation exists and is awaiting approval, the new owner is a different person, a human, with a reason, and **not out of office** (otherwise it returns an error and nothing changes).
4. It calls `appendEvent` (`domain/audit.ts`) to create an `OwnerReassigned` event with the next sequence number, and returns a **new** state in which that operation's `decisionOwnerId` is Ingrid's.
5. The store saves the new state. React notices and redraws every component that uses it.
6. Those components call selectors. `findings(state)` (in `findings.ts`) checks "is a blocked operation's owner unavailable?" for each blocked operation. This one no longer matches, so **the finding is simply absent**: the list drops from 8 to 7, the map clears the red highlight, the rail badge changes, the Overview card updates.
7. The panel shows "Decision moved to Ingrid Novak… still awaiting approval" with a link to the audit event.

The operation stays **awaiting approval** on purpose: moving the decision does not approve the wire; the new person still has to decide.

---

## 6. The authorization and audit engine (Mission 2)

Files: `domain/authorize.ts`, `domain/reducer.ts`, `domain/audit.ts`, `ui/screens/Governance/*`.

**Policy:** authorization must be valid at the instant a consequential action executes. Revoking before execution prevents it.

**Permissions are a story, not a field.** For each AI worker and each "scope" (a permission such as `payments:wire:execute`), the log holds events: `grant` (optionally with a dollar limit), `modify` (change the limit), `revoke`. To know the permission *at a moment*, replay those events in order up to that moment (`scopeStateAsOf`):
- start as "not granted";
- `grant` → active with the limit; `modify` → new limit (only if active); `revoke` → not active.

**"A moment" is a sequence number.** Every event has a global `seq` (1, 2, 3 …). "As of #310" means every event with seq ≤ 310. Timestamps are only for display, because they can tie or be wrong; a counter is unambiguous.

**Worked example (the featured incident, "Wire $120,000 to Northwind Escrow")**
```
#26   grant    the wire permission is provisioned          (Standard role provisioning)
#217  modify   limit lowered to $150,000                    (Quarterly limit review)
#307  started  the $120,000 wire operation starts
#309  revoke   permission revoked                           (Vendor placed under sanctions review)
#310  evaluated AuthorizationEvaluated: cutoff = #309, permission revoked -> DENIED (reason REVOKED)
#311  prevented ExecutionPrevented: the wire does not run
#318  grant    permission restored                          (Review cleared, access restored)
```
At #310 the engine reads events up to #309, finds a revoke last, and denies. The decision event stores the cutoff, the state it saw, and the ids of the permission events it relied on. After #318 the permission is active again, but the stored #310 decision does not change. The replay slider lets you move through #26, #217, #307, #309, #310, #311 and #318 and see "Authorized then" vs "Permitted now".

**Integrity check.** "Re-check from the record" (`replayMatches`) recomputes the decision from the log and compares it with the stored one: Verified or Mismatch.

**Reason codes:** `ACTIVE_GRANT` (allowed), `NO_GRANT`, `REVOKED`, `LIMIT_EXCEEDED` (denied).

**Accountability:** each AI worker has an owner (person); each operation an approver; each event the actor who did it; the replay shows all three.

**Limits to state honestly:** one execution step per operation; the "acting as" role is not a login; browser simulation, not production security.

---

## 7. Findings and metrics (Mission 1)

`domain/findings.ts` produces a ranked list. Nothing is stored; each render recomputes it from the data:

| Finding | Rule |
| --- | --- |
| Blocked decision | an operation is `awaiting_approval` **and** its approver is out of office |
| Conflicting objectives | an open conflict of kind `contradiction` (two missions pull opposite ways on one resource) |
| Duplicated work | an open conflict of kind `duplicate` |
| Cost without verified value | a mission with at least 5 active AI workers without verified value whose modeled cost rose 25% or more vs the previous 30 days (a **simulated** figure) |
| Permission changed after work started | an in-progress operation that would be denied if it ran now |

Ranking: severity first, then kind, then how many workers it touches. Each finding also carries a **cause chain** (why it happened), a **consequence**, the **people and workers it reaches** (so the map can zoom and highlight them), and an **action** (`FindingActions.tsx`).

**Value classes** (`classifyAiWorkers`): each active AI worker is *verified* (at least one value record confirmed in a system of record), *estimated only* (model-based records only), or *unmeasured* (no records). Never added together. **Return on cost** (`domain/roi.ts`) is verified value over modeled cost only; estimated value never counts. No savings or profit anywhere. "Coverage" = verified workers ÷ active AI workers (a head count, not dollars).

`selectors.ts` also provides team tables, queue counts, the case list for Governance, "then vs now", and governance stats.

---

## 8. The map

`domain/orgLayout.ts` computes positions with fixed rules (no physics): 8 team regions in a 4×2 grid; each person who owns AI workers is a **pod** with their AI dots around them; the executive sits on top with reporting lines. Same input always gives the same picture (tested). `ui/screens/Workforce/map/` draws it as SVG and animates the camera: `WorkforceMap.tsx` (drawing and camera), `MapView.tsx` (page logic), `SituationPanel.tsx` (the side panel), `overlays.ts` (what each lens emphasizes), `selection.ts` (what a URL id means). Dot encoding: solid = verified, hatched = estimated, outlined = unmeasured.

---

## 9. Navigation and the URL

- `Root.tsx` reads `routeOf(window.location.hash)` from `state/router.ts`: `#/` landing, `#/demo`, `#/intro`, anything else the System.
- Inside the System, `state/nav.tsx` keeps the current screen and selected record (`#/governance/op-d1` means Governance, record `op-d1`), a "Back to…" memory so a case never loses its thread, and the toast message.
- `?embed=1` makes the page show only the System. The demo player uses it to show the real app in an iframe.
- Heavy pages (System, demo, film) load on demand (`React.lazy`), which cut the landing page download from 431 KB to 234 KB.

---

## 10. The screens and the design system

| Screen (URL) | Code | Purpose |
| --- | --- | --- |
| Start here (`#/overview`) | `screens/Overview` | three questions with live numbers; detail collapsed below |
| Needs attention (`#/queue`) | `screens/WorkQueue` | every blocked operation, conflict and performance concern; drawers to act |
| Org map (`#/workforce`) | `screens/Workforce` | map + findings list; Registry tab lists all 550 workers; worker profile and permission dialog |
| AI accountability (`#/governance`) | `screens/Governance` | cases, featured incident, case page with replay, the technical record |

`ui/shell/AppShell.tsx` is the frame: left rail with the four screens and counts, top bar with links home, GitHub, Demo and the **demo role** chip, Reset demo, and the toast. `ui/primitives/` are the reusable pieces.

**Design system** (`DESIGN.md`, `src/styles/tokens.css`): all colours, sizes and radii are named variables in one file. Warm stone ground in the System, a night-violet rail, one violet accent for interaction and verified value, red/amber only for severity, green only for "allowed". Fonts Geist (UI), Geist Mono (ids, numbers), Newsreader italic (one accent phrase per page title), self-hosted. Hairline borders instead of shadows. Contrast is checked by a test.

---

## 11. Landing page, demo player, brand film, email

- **Landing** (`ui/landing`): black page, big logo, the two challenges, how it works, an honest "about the data" section, buttons to the System, demo, film and GitHub (`config/site.ts`).
- **Demo player** (`ui/demo`): not a video. `script.ts` is a storyboard of 8 chapters; `Demo.tsx` loads the real app in an iframe and, for each step, finds a real element in it, glides a fake cursor there, and clicks it for real. So the decision really moves and the worker really pauses. `music.ts` makes quiet ambient music with the browser's audio API. `tests/demo-integrity.test.tsx` runs the same script against the app to make sure no step can break unnoticed.
- **Brand film** (`ui/intro`): `film.ts` draws 550 dots on a canvas as a function of time (activate, collide, align, logo reveal); `score.ts` synthesizes the sound. Sound starts off because browsers forbid autoplay audio.
- **Email** (`docs/email/wand-horizon-intro.html`): table-based HTML (the only layout Gmail trusts) in the same black and lilac style.

---

## 12. Tests, build, deploy

- `npm run dev` runs it locally; `npm test` runs 130 tests; `npm run build` makes the static files; `npx oxlint` checks style.
- Tests cover: the authorization rules and history (`domain.test.ts`), the data (`generate.test.ts`), findings (`findings.test.ts`), the map layout (`orgLayout.test.ts`), case and governance maths (`cases.test.ts`), contrast (`contrast.test.ts`), the UI flows (`flows`, `map`, `replay`), routes (`site`, `router`), and the demo script (`demo-integrity`).
- **GitHub Actions** (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build on every push.
- **Deploy:** the built static files are hosted on Vercel at `wand-horizon.vercel.app`. There is no server code.

---

## 13. Glossary

- **Action:** a request to change data ("reassign this decision").
- **Append-only:** only add, never edit or delete.
- **AppState:** the one object holding all data in memory.
- **Audit event:** one line in the log.
- **Component:** a reusable piece of screen.
- **Derived:** calculated from stored data when needed, not stored.
- **Finding:** a ranked problem the system noticed.
- **Hash URL:** the `#/…` part of the address.
- **Mission:** a goal several AI workers serve, owned by a person.
- **Operation:** one piece of work an AI does (e.g. a wire).
- **Pod:** a person with the AI workers they are accountable for, on the map.
- **Pure function:** same input, same output, no side effects.
- **Reducer:** pure function (old state, action) → new state.
- **Scope:** a named permission, like `payments:wire:execute`.
- **Selector:** a read-only function that answers a question from the data.
- **seq:** the global event counter that defines order.
- **Seeded random:** repeatable randomness.
- **State:** the data currently shown.
- **Synthetic data:** made-up data.

---

## 14. Beginner questions and answers

**Where is the database?** There is none. See section 3.

**So is anything saved when I click things?** No. Changes live in memory until you refresh. The audit "log" is a list in memory, not a file.

**Then why call it an audit trail?** The design is the point: an append-only log with sequence numbers, from which every permission and decision is rebuilt. The same design would be backed by durable storage in production.

**Why can't a screen change the data directly?** Because then rules could be bypassed and the log would miss entries. All changes go through `applyAction`, which validates and logs.

**What stops someone editing the log?** Inside the app, no code edits or deletes events; `appendEvent` is the only place events are created (tested: "never edits earlier ones"). This is a simulation; a real system needs storage that enforces it.

**What is the "demo role"?** A dropdown (Executive / Manager / Investigator) that only sets whose name is written on the events you create. It is not a login.

**Why is the data the same every time?** The random generator is seeded and the "now" is fixed, so generation is deterministic.

**Why are there 340 events if I haven't done anything?** They are the pre-made history, produced by replaying scripted actions through the real reducer when the app starts.

**What does "simulated" mean on the cost numbers?** The "previous 30 days" cost is generated from the same model as the current cost. There is no real time series, so we label it simulated and never claim it as measurement.

**How can the demo "click" the app?** It loads the real app in an iframe from the same site, so the script can look inside and call `.click()` on real buttons. The fake cursor is just an overlay.

**How do I run it?** `npm install`, then `npm run dev` (on Windows PowerShell use `npm.cmd`). Open http://localhost:5173.

**What would you build next?** Durable storage and real authentication, multi-step operations, real activity and cost time series, human-vs-AI conflicts, and a dedicated investigator view.
