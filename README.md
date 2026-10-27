# Wand Horizon

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

## Routes and configuration

The whole site uses the URL hash, so direct loads and refreshes work on any static host with no rewrite rules.

| URL | Page |
| --- | --- |
| `/` or `/#/` | Introduction landing page |
| `/#/demo` | Product demo player |
| `/#/intro` | Brand film (about 22 seconds) |
| `/#/system` | The System (opens on Overview); `#/overview`, `#/queue`, `#/workforce`, `#/governance` and their deep links also open the System |

Set these at build time (a `.env` file or the host's build settings); see `src/config/site.ts`:

| Variable | Purpose |
| --- | --- |
| `VITE_GITHUB_REPO_URL` | The repository URL for the "View GitHub Repository" buttons. Defaults to `https://github.com/OfekBP/wand-horizon`. |

## The product demo

`/#/demo` plays a deterministic, roughly 80-second walkthrough of the real application: the executive overview, a conflict and a blocked decision on the workforce map (the decision is actually moved, writing a real audit event), and the reconstruction of a historical authorization incident. It is **not a rendered video file**. The player embeds the System in an iframe (`/?embed=1`) on its own fresh state and drives it with a scripted cursor, real clicks and captions, so every number on screen is the product's own. Chapters are clickable (each restarts the run from that chapter), and there are pause and mute controls. The background music is generated in the browser with the Web Audio API and starts only from the Play button.

The script lives in `src/ui/demo/script.ts`; to change the walkthrough edit the scenes there. If the application's labels change, scenes skip a missing element rather than stop.

## The brand film

`/#/intro` is a separate, self-playing cinematic introduction (22 seconds, not the product demo): hundreds of AI workers activate, their connections multiply and collide, then everything resolves into an ordered organization and the logo is revealed with the line "Command the intelligence workforce." It is a canvas animation that is a pure function of time (`src/ui/intro/film.ts`), with a score synthesized live in the browser (`src/ui/intro/score.ts`, no audio files). Browsers do not allow audio to start by itself, so it plays silently until **Turn sound on** is pressed; the sound then joins at the current moment. Controls: **Replay**, sound toggle, and end links to the System and the demo. Users with reduced-motion set see the final frame instead of the animation. It is an illustration of the idea, not product data.

Use **Reset demo** (bottom of the sidebar) to restore the original data. State is in memory only, so a refresh also resets it.

## Where to start

The System opens on **Start here** with three plain questions: *Is anything stuck?*, *Is the AI spend justified?* and *What was the AI allowed to do?* Each has a live number and one button into the matching story; everything else (the full list, value, cost, teams) is under "More detail". The four screens are named for the question they answer: **Start here**, **Needs attention** (the work queue), **Org map** (the workforce map and registry) and **AI accountability** (the audit cases and incident replay). The org map opens on the most urgent issue the first time it is visited in a session, and a case page puts the incident replay first with the event-by-event record under "Technical record".

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

## More

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): code layout, the authorization and audit model, metric definitions, the decision log and known limitations.
- [docs/email/wand-horizon-intro.html](docs/email/wand-horizon-intro.html): the introduction email (paste the HTML into Gmail, or open it in a browser to preview). It loads the logo from the live site.
- [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md): the design system and product context.
- Every push and pull request runs typecheck, lint, tests and the build (`.github/workflows/ci.yml`).

All data is synthetic and the authorization logic is a browser simulation, not production-grade security.
