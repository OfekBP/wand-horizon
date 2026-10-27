---
version: 1
slug: "src-ui"
primary_target: "src/ui"
related_targets: ["src/styles"]
---

---
version: 1
slug: "src-ui"
primary_target: "src/ui"
related_targets: ["src/styles"]
---

# Surface brief: Accord app shell and the four screens

## Scope and visitor mode
Operate. Redesign of the visual world and information architecture of the whole app (shell, Overview, Work Queue, Workforce, Governance). Product truth, workflows, domain rules and data are preserved.

## Audience, job, constraints
Executive and Investigator equally; Manager supporting. Jobs: see what needs a decision and whether authority is at risk; reconstruct what was authorized at execution time from stored decisions. Constraints: no ROI or trend claims, verified/estimated/unmeasured never summed, browser simulation disclaimer, React/TS/Vite, no new runtime dependencies. User pinned the direction: restrained editorial inspired by wand.ai (Geist, one italic Newsreader phrase, warm stone and night chapters, violet accent), original logo.

## Direction contract
THESIS: An operation is both something to manage and a record to prove. The product refuses the "dashboard plus separate audit log" split: every screen links operational state to stored authority and back, and a case keeps its context as the user moves between lenses.
OWN-WORLD: Warm stone ground and paper surfaces, ink text, a night violet-black nav rail, one violet accent for interaction and verified value (solid verified, hatched estimated, outlined unmeasured), pale violet on the rail. Geist for UI and tabular figures, Geist Mono for ids, scopes and sequence numbers, Newsreader italic only for one phrase in a page title and in empty states. Pill primary buttons, hairline borders instead of shadows, red/amber for severity and green for allowed only.
STORY: The executive sees what needs a decision and which in-flight operations would now be denied, and acts. The investigator opens any case and sees the decision stored at execution time beside today's permission, with the evidence and a replay check. Both can move from problem to cause to evidence without losing the thread.
FIRST VIEWPORT: Overview at 1440x900: night rail on the left (logo, Overview, Operate group with Work Queue and Workforce, Assure group with Governance); top bar with back link, simulated role and reset; page title with as-of time. First row is two working lanes, "Needs a decision" (the most severe blocked operations with owner, age and an Investigate link) beside "Authority at risk" (in-progress operations that would be denied if run now, linking to their evidence). Below: a value ledger with verified value dominant over estimated and unmeasured, then operating cost. No row of metric cards.
FORM: Operate shell with standard controls; world supplies type, palette, density and one signature move: the sequence gutter, a monospace #seq column anchoring timelines, evidence and the event log, plus "authority at attempt" lines on case rows. seed: none (direction pinned by the user in their own words: the brief asked for visual inspiration from wand.ai, and the tone question was answered "Restrained editorial"; per brief-wins, no roll was run).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
Product name "Accord" is a working name. Logo: overlapping circle (people) and rounded square (AI workers) with the overlap in violet.
