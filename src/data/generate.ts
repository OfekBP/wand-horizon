import { applyAction, SCOPES, type Action } from '../domain/reducer'
import type {
  Actor,
  AppState,
  Conflict,
  Operation,
  PerformanceConcern,
  Severity,
  SimRole,
  Team,
  ValueRecord,
  Worker,
} from '../domain/types'
import { createRng, DAY, HOUR, iso, MINUTE, NOW } from './prng'

/*
 * Deterministic synthetic fixtures: 50 humans, 500 AI workers.
 * Bulk data is generated from a seeded PRNG. The audit history is NOT hand-written:
 * it is produced by replaying scripted actions through the real reducer, so every
 * event, seq number and authorization decision is consistent by construction.
 */

interface FnSpec {
  name: string
  scope?: string
  responsibilities: string[]
  cost: number
}
interface TeamSpec {
  id: string
  name: string
  humans: number
  ai: number
  verifiedSource: string
  fns: FnSpec[]
}

const TEAM_SPECS: TeamSpec[] = [
  {
    id: 't-treasury', name: 'Treasury', humans: 6, ai: 60, verifiedSource: 'Custodian statement reconciliation',
    fns: [
      { name: 'Settlement-Recon', scope: 'settlement:release', cost: 900, responsibilities: ['Reconcile settlement files against custodian statements', 'Prepare settlement batches for release'] },
      { name: 'Cash-Position', cost: 450, responsibilities: ['Compile intraday cash position', 'Flag funding shortfalls'] },
      { name: 'Liquidity-Forecast', cost: 700, responsibilities: ['Forecast 14-day liquidity', 'Recommend buffer adjustments'] },
      { name: 'FX-Hedge-Monitor', cost: 600, responsibilities: ['Monitor FX exposure against limits'] },
    ],
  },
  {
    id: 't-payments', name: 'Payments Operations', humans: 7, ai: 80, verifiedSource: 'Payments gateway settlement report',
    fns: [
      { name: 'Payments-Disburse', scope: 'payments:wire:execute', cost: 850, responsibilities: ['Prepare and execute approved outbound wires', 'Confirm beneficiary details before release'] },
      { name: 'Payment-Screen', cost: 520, responsibilities: ['Screen beneficiaries against watchlists'] },
      { name: 'Exception-Triage', cost: 380, responsibilities: ['Triage failed payments', 'Route repairs to the owning team'] },
      { name: 'Remittance-Match', cost: 340, responsibilities: ['Match remittances to open invoices'] },
    ],
  },
  {
    id: 't-claims', name: 'Claims', humans: 6, ai: 70, verifiedSource: 'Claims system settled payouts',
    fns: [
      { name: 'Claims-Payout', scope: 'claims:payout:approve', cost: 780, responsibilities: ['Approve claim payouts within authority', 'Document payout rationale'] },
      { name: 'Claims-Intake', cost: 300, responsibilities: ['Extract and validate first-notice-of-loss data'] },
      { name: 'Fraud-Signal', cost: 640, responsibilities: ['Score claims for fraud signals'] },
      { name: 'Subrogation-Scout', cost: 520, responsibilities: ['Identify recovery opportunities'] },
    ],
  },
  {
    id: 't-support', name: 'Customer Support', humans: 6, ai: 70, verifiedSource: 'CRM closed-resolution audit',
    fns: [
      { name: 'Refund-Issue', scope: 'refund:issue', cost: 260, responsibilities: ['Issue refunds within policy limits'] },
      { name: 'Support-Resolve', cost: 220, responsibilities: ['Resolve tier-1 support tickets'] },
      { name: 'Account-Update', cost: 240, responsibilities: ['Process account change requests'] },
      { name: 'Escalation-Router', cost: 200, responsibilities: ['Route complex cases to specialists'] },
    ],
  },
  {
    id: 't-compliance', name: 'Compliance', humans: 6, ai: 45, verifiedSource: 'Case management system closure',
    fns: [
      { name: 'Sanctions-Review', scope: 'sanctions:hold:release', cost: 920, responsibilities: ['Review sanctions holds', 'Release holds cleared by a reviewer'] },
      { name: 'KYC-Refresh', cost: 560, responsibilities: ['Refresh customer due-diligence files'] },
      { name: 'Alert-Triage', cost: 600, responsibilities: ['Triage transaction-monitoring alerts'] },
      { name: 'Reg-Report-Draft', cost: 700, responsibilities: ['Draft regulatory filings for human review'] },
    ],
  },
  {
    id: 't-risk', name: 'Risk Analytics', humans: 6, ai: 55, verifiedSource: 'Risk data warehouse backtest',
    fns: [
      { name: 'Reserve-Adjust', scope: 'reserve:adjust', cost: 1100, responsibilities: ['Propose and post loss-reserve adjustments'] },
      { name: 'Exposure-Model', cost: 1300, responsibilities: ['Recompute credit exposure'] },
      { name: 'Stress-Test-Run', cost: 1500, responsibilities: ['Run scheduled stress scenarios'] },
      { name: 'Portfolio-Watch', cost: 640, responsibilities: ['Monitor concentration limits'] },
    ],
  },
  {
    id: 't-underwriting', name: 'Underwriting', humans: 6, ai: 50, verifiedSource: 'Policy admin bound premium',
    fns: [
      { name: 'Policy-Bind', scope: 'policy:bind', cost: 820, responsibilities: ['Bind policies within appetite and authority'] },
      { name: 'Submission-Intake', cost: 360, responsibilities: ['Parse broker submissions'] },
      { name: 'Pricing-Assist', cost: 980, responsibilities: ['Prepare pricing recommendations'] },
      { name: 'Renewal-Review', cost: 520, responsibilities: ['Review renewals against appetite'] },
    ],
  },
  {
    id: 't-finops', name: 'Finance Operations', humans: 7, ai: 70, verifiedSource: 'ERP ledger reconciliation',
    fns: [
      { name: 'Ledger-Adjust', scope: 'ledger:adjust', cost: 690, responsibilities: ['Post approved ledger adjustments'] },
      { name: 'Invoice-Match', cost: 320, responsibilities: ['Three-way match supplier invoices'] },
      { name: 'Accrual-Prep', cost: 540, responsibilities: ['Prepare month-end accruals'] },
      { name: 'Close-Checklist', cost: 420, responsibilities: ['Track close tasks and variances'] },
    ],
  },
]

const SCOPE_LIMIT: Record<string, number> = {
  'payments:wire:execute': 500_000,
  'settlement:release': 3_000_000,
  'claims:payout:approve': 150_000,
  'ledger:adjust': 250_000,
  'refund:issue': 25_000,
  'reserve:adjust': 1_000_000,
  'policy:bind': 300_000,
  'sanctions:hold:release': 100_000,
}

const SCOPE_AMOUNT: Record<string, [number, number]> = {
  'payments:wire:execute': [8_000, 420_000],
  'settlement:release': [200_000, 2_600_000],
  'claims:payout:approve': [4_000, 120_000],
  'ledger:adjust': [5_000, 180_000],
  'refund:issue': [400, 18_000],
  'reserve:adjust': [50_000, 800_000],
  'policy:bind': [20_000, 250_000],
  'sanctions:hold:release': [10_000, 80_000],
}

const FIRST_NAMES = [
  'Aaron', 'Amara', 'Anders', 'Beatriz', 'Callum', 'Chidi', 'Daniela', 'Dev', 'Elif', 'Fatima', 'Felix', 'Gabriel',
  'Hana', 'Idris', 'Ingrid', 'Jonas', 'Kavya', 'Kwame', 'Lena', 'Liam', 'Mateo', 'Mei', 'Nadia', 'Noah', 'Olu',
  'Omar', 'Paloma', 'Quinn', 'Rafael', 'Rhea', 'Sana', 'Sven', 'Tariq', 'Thea', 'Uma', 'Viktor', 'Wen', 'Xavier',
  'Yara', 'Zane', 'Aisha', 'Bruno', 'Carmen', 'Dmitri', 'Esme', 'Farid', 'Greta', 'Hugo', 'Isla', 'Jamal', 'Keiko',
  'Leo', 'Maya', 'Nico', 'Orla', 'Pablo',
]
const LAST_NAMES = [
  'Abbott', 'Bianchi', 'Castillo', 'Dubois', 'Eriksen', 'Farouk', 'Gallagher', 'Haddad', 'Ivanov', 'Jensen',
  'Kowalski', 'Lindqvist', 'Mbeki', 'Nakamura', 'Okafor', 'Petrov', 'Quintero', 'Rossi', 'Sato', 'Tanaka',
  'Ueda', 'Varga', 'Weber', 'Xu', 'Yilmaz', 'Zielinski', 'Brandt', 'Chaudhry', 'Delgado', 'Egan', 'Fischer',
  'Greene', 'Hoffman', 'Iyer', 'Jimenez', 'Khan', 'Lopes', 'Moreau', 'Novak', 'Ortega',
]
const HUMAN_ROLES = ['Operations Manager', 'Senior Analyst', 'Control Owner', 'Business Analyst', 'Process Owner', 'Operations Specialist']

/** Hand-authored people the four demo flows depend on. */
const LEADS: Record<string, { name: string; role: string }> = {
  't-treasury': { name: 'Elena Park', role: 'Head of Treasury' },
  't-payments': { name: 'Priya Raman', role: 'Head of Payments Operations' },
  't-compliance': { name: 'Marcus Hale', role: 'Director, Compliance Investigations' },
  't-finops': { name: 'Dana Whitfield', role: 'Chief Operating Officer' },
}

const VENDORS = ['Halden Freight Ltd', 'Brightwater Logistics', 'Corvid Packaging', 'Meridian Facilities', 'Alder & Finch LLP', 'Tessel Cloud Services', 'Orchard Print Group', 'Larkspur Utilities']
const BLOCK_REASONS = [
  'Approver out of office with no delegate assigned',
  'Second approver not yet identified',
  'Awaiting compliance sign-off on the counterparty',
  'Amount exceeds the approver’s delegated authority',
  'Supporting documents incomplete',
]
const SCOPE_VERB: Record<string, string> = {
  'payments:wire:execute': 'wire',
  'settlement:release': 'settlement release',
  'claims:payout:approve': 'claim payout',
  'ledger:adjust': 'ledger adjustment',
  'refund:issue': 'refund batch',
  'reserve:adjust': 'reserve adjustment',
  'policy:bind': 'policy binding',
  'sanctions:hold:release': 'sanctions hold release',
}

const TITLE: Record<string, (amount: string, ref: number, vendor: string) => string> = {
  'payments:wire:execute': (a, _r, v) => `Wire ${a} to ${v}`,
  'settlement:release': (a, r) => `Release settlement batch SB-${r} (${a})`,
  'claims:payout:approve': (a, r) => `Approve payout for claim CL-${r} (${a})`,
  'ledger:adjust': (a, r) => `Post ledger adjustment ADJ-${r} (${a})`,
  'refund:issue': (a, r) => `Issue refund batch RF-${r} (${a})`,
  'reserve:adjust': (a, r) => `Adjust loss reserve for portfolio PF-${r} (${a})`,
  'policy:bind': (a, r) => `Bind policy PB-${r} (${a})`,
  'sanctions:hold:release': (a, r) => `Release sanctions hold on case SC-${r} (${a})`,
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const pad = (n: number, width = 3) => String(n).padStart(width, '0')
const round = (n: number, step: number) => Math.round(n / step) * step

interface Step {
  at: number
  action: Action
}

export const SYSTEM_ACTOR = 'Policy Admin'

export function createInitialState(): AppState {
  const rng = createRng(20261026)

  /* ---------- teams and humans ---------- */
  const teams: Team[] = TEAM_SPECS.map((t) => ({ id: t.id, name: t.name }))
  const heroNames = new Set(Object.values(LEADS).map((l) => l.name.split(' ')[0]))
  const firstNames = rng.shuffle(FIRST_NAMES.filter((n) => !heroNames.has(n)))
  const lastNames = rng.shuffle(LAST_NAMES)

  const workers: Worker[] = []
  const leadByTeam = new Map<string, string>()
  let humanIdx = 0
  for (const spec of TEAM_SPECS) {
    for (let i = 0; i < spec.humans; i++) {
      const id = `h-${pad(++humanIdx)}`
      const isLead = i === 0
      const hero = isLead ? LEADS[spec.id] : undefined
      workers.push({
        id,
        kind: 'human',
        name: hero?.name ?? `${firstNames[humanIdx]} ${lastNames[(humanIdx * 7 + 3) % lastNames.length]}`,
        role: hero?.role ?? (isLead ? `Head of ${spec.name}` : HUMAN_ROLES[(i - 1) % HUMAN_ROLES.length]),
        teamId: spec.id,
        status: 'active',
        ownerId: null,
        responsibilities: isLead
          ? [`Accountable for ${spec.name} outcomes`, 'Approves consequential operations']
          : [`Supervises ${spec.name} AI workers`, 'Reviews exceptions and escalations'],
        monthlyCost: round(isLead ? rng.float(20_000, 24_000) : rng.float(9_500, 17_500), 100),
      })
      if (isLead) leadByTeam.set(spec.id, id)
    }
  }
  const execId = workers.find((w) => w.name === 'Dana Whitfield')!.id
  for (const w of workers) {
    if (w.kind !== 'human') continue
    const lead = leadByTeam.get(w.teamId)!
    w.ownerId = w.id === execId ? null : w.id === lead ? execId : lead
  }

  /* ---------- AI workers ---------- */
  const fnOf = new Map<string, FnSpec>()
  const counters = new Map<string, number>()
  let aiIdx = 0
  for (const spec of TEAM_SPECS) {
    const owners = workers.filter((w) => w.kind === 'human' && w.teamId === spec.id && w.id !== leadByTeam.get(spec.id))
    for (let i = 0; i < spec.ai; i++) {
      const fn = spec.fns[i % spec.fns.length]
      const n = (counters.get(fn.name) ?? 0) + 1
      counters.set(fn.name, n)
      const id = `a-${pad(++aiIdx)}`
      workers.push({
        id,
        kind: 'ai',
        name: `${fn.name}-${pad(n)}`,
        role: fn.name.replace(/-/g, ' '),
        teamId: spec.id,
        status: 'active',
        ownerId: owners[i % owners.length].id,
        responsibilities: fn.responsibilities,
        monthlyCost: round(fn.cost * rng.float(0.7, 1.4), 10),
      })
      fnOf.set(id, fn)
    }
  }
  const ai = workers.filter((w) => w.kind === 'ai')
  const human = (name: string) => workers.find((w) => w.kind === 'human' && w.name === name)!
  const aiByName = (name: string) => {
    const w = ai.find((x) => x.name === name)
    if (!w) throw new Error(`Fixture worker missing: ${name}`)
    return w
  }
  const leadOf = (teamId: string) => workers.find((w) => w.id === leadByTeam.get(teamId))!

  /* ---------- value: exact class counts so coverage is reproducible ---------- */
  const order = rng.shuffle(ai.map((w) => w.id))
  const VERIFIED_N = 290
  const ESTIMATED_ONLY_N = 140
  const values: ValueRecord[] = []
  const sourceOf = (teamId: string) => TEAM_SPECS.find((t) => t.id === teamId)!.verifiedSource
  order.forEach((id, i) => {
    const w = ai.find((x) => x.id === id)!
    if (i < VERIFIED_N) {
      values.push({ id: `v-${pad(values.length + 1, 4)}`, workerId: id, basis: 'verified', amount: round(w.monthlyCost * rng.float(4, 22), 100), source: sourceOf(w.teamId) })
      if (rng.float() < 0.4)
        values.push({ id: `v-${pad(values.length + 1, 4)}`, workerId: id, basis: 'estimated', amount: round(w.monthlyCost * rng.float(2, 10), 100), source: 'Time-saved model (hours x loaded rate)' })
    } else if (i < VERIFIED_N + ESTIMATED_ONLY_N) {
      values.push({ id: `v-${pad(values.length + 1, 4)}`, workerId: id, basis: 'estimated', amount: round(w.monthlyCost * rng.float(5, 30), 100), source: rng.pick(['Time-saved model (hours x loaded rate)', 'Loss-avoidance model']) })
    }
  })

  /* ---------- conflicts (open at seed; two resolved via scripted actions) ---------- */
  const mkConflict = (id: string, a: string, b: string, resource: string, summary: string, severity: Severity, agoMs: number): Conflict => ({
    id, workerAId: aiByName(a).id, workerBId: aiByName(b).id, resource, summary, severity, detectedAt: iso(NOW - agoMs), status: 'open',
  })
  const conflicts: Conflict[] = [
    mkConflict('c-001', 'Payments-Disburse-003', 'Liquidity-Forecast-005', 'Intraday liquidity buffer (USD operating account)', 'Payments-Disburse-003 is releasing funds that Liquidity-Forecast-005 has reserved for the 16:00 settlement window.', 'high', 5 * HOUR),
    mkConflict('c-002', 'Claims-Intake-012', 'Fraud-Signal-008', 'Claim CL-71130 case file', 'Intake marked the claim “validated” while fraud scoring placed the same claim on hold.', 'high', 9 * HOUR),
    mkConflict('c-003', 'Ledger-Adjust-006', 'Accrual-Prep-004', 'Accrual account 2150', 'Both workers are posting to the same accrual account for the October close.', 'medium', 1 * DAY + 3 * HOUR),
    mkConflict('c-004', 'Pricing-Assist-003', 'Renewal-Review-009', 'Renewal quote RQ-5521', 'Pricing revised the premium after Renewal-Review had already issued its recommendation.', 'medium', 2 * DAY),
    mkConflict('c-005', 'Alert-Triage-007', 'KYC-Refresh-002', 'Customer risk rating, account C-30417', 'Two workers set different risk ratings for the same customer within one hour.', 'low', 3 * DAY),
    mkConflict('c-006', 'Refund-Issue-004', 'Support-Resolve-010', 'Refund request RF-2209', 'Both workers attempted to action the same refund request.', 'medium', 6 * DAY),
    mkConflict('c-007', 'Remittance-Match-003', 'Exception-Triage-005', 'Payment batch PB-8841', 'Remittance matching and exception triage both claimed the same payment batch.', 'low', 8 * DAY),
  ]

  /* ---------- performance concerns ---------- */
  const heroWorkerNames = new Set([
    'Settlement-Recon-007', 'Payments-Disburse-003', 'Payments-Disburse-011', 'Payments-Disburse-014',
    'Claims-Payout-005', 'Claims-Payout-009', 'Sanctions-Review-004', 'Ledger-Adjust-002',
  ])
  const concernKinds: Array<{ metric: string; unit: PerformanceConcern['unit']; threshold: number; lo: number; hi: number }> = [
    { metric: 'Error rate', unit: '%', threshold: 2, lo: 3.5, hi: 9 },
    { metric: 'Rework rate', unit: '%', threshold: 8, lo: 12, hi: 24 },
    { metric: 'Cost per task', unit: '$', threshold: 0.5, lo: 0.8, hi: 1.4 },
    { metric: 'Median handling time', unit: 'min', threshold: 25, lo: 38, hi: 64 },
  ]
  const concernPool = rng.shuffle(ai.filter((w) => !heroWorkerNames.has(w.name))).slice(0, 12)
  const concerns: PerformanceConcern[] = concernPool.map((w, i) => {
    const k = concernKinds[i % concernKinds.length]
    const observed = round(rng.float(k.lo, k.hi), k.unit === '$' ? 0.01 : 0.1)
    const ratio = observed / k.threshold
    return {
      id: `pc-${pad(i + 1)}`, workerId: w.id, metric: k.metric, observed, threshold: k.threshold, unit: k.unit,
      severity: ratio >= 2.5 ? 'high' : ratio >= 1.6 ? 'medium' : 'low',
      status: 'open', note: `Above threshold on ${rng.int(4, 7)} of the last 7 days.`,
    }
  })
  concerns.push({
    id: `pc-${pad(concerns.length + 1)}`, workerId: aiByName('Payments-Disburse-003').id, metric: 'Error rate', observed: 5.1, threshold: 1,
    unit: '%', severity: 'high', status: 'open', note: 'Beneficiary-detail mismatches on 4 of the last 7 days.',
  })

  /* ---------- scripted history, replayed through the real reducer ---------- */
  const steps: Step[] = []
  const push = (at: number, action: Action) => steps.push({ at, action })

  // Standard role provisioning: every worker in an operation-bearing function holds its scope.
  ai.forEach((w, i) => {
    const scope = fnOf.get(w.id)?.scope
    if (!scope) return
    push(NOW - 40 * DAY + i * 1000, {
      type: 'CHANGE_PERMISSION', at: iso(NOW - 40 * DAY + i * 1000), actor: SYSTEM_ACTOR, workerId: w.id,
      scope, action: 'grant', limit: SCOPE_LIMIT[scope], reason: 'Standard role provisioning',
    })
  })

  const mkOp = (o: Partial<Operation> & Pick<Operation, 'id' | 'workerId' | 'requiredScope' | 'amount' | 'status' | 'startedAt'>): Operation => {
    const w = workers.find((x) => x.id === o.workerId)!
    return {
      title: '', summary: '', decisionOwnerId: leadOf(w.teamId).id, severity: 'medium', ...o,
    }
  }
  const startOp = (op: Operation) =>
    push(Date.parse(op.startedAt), { type: 'START_OPERATION', at: op.startedAt, actor: 'Workflow engine', operation: op })
  const attempt = (op: Operation, at: number) =>
    push(at, { type: 'ATTEMPT_EXECUTION', at: iso(at), actor: workers.find((w) => w.id === op.workerId)!.name, operationId: op.id })
  const permission = (at: number, actor: string, workerId: string, scope: string, action: 'grant' | 'modify' | 'revoke', reason: string, limit?: number) =>
    push(at, { type: 'CHANGE_PERMISSION', at: iso(at), actor, workerId, scope, action, limit, reason })

  /* hero operations */
  const heroWorkerIds = new Set([...heroWorkerNames].map((n) => aiByName(n).id))
  const elena = human('Elena Park')
  const priya = human('Priya Raman')
  const marcus = human('Marcus Hale')

  // A: critical blocked operations (reassign target for flow A)
  startOp(mkOp({
    id: 'op-a1', workerId: aiByName('Settlement-Recon-007').id, requiredScope: 'settlement:release', amount: 2_400_000, status: 'awaiting_approval',
    startedAt: iso(NOW - 2 * DAY - 3 * HOUR), awaitingSince: iso(NOW - 2 * DAY - 3 * HOUR), severity: 'critical', decisionOwnerId: elena.id,
    title: `Release settlement batch SB-2291 (${usd(2_400_000)})`,
    summary: 'Custodian cut-off is in 20 hours. Reconciliation is complete and the batch is ready; only the human release decision is missing.',
    blockReason: `Approver ${elena.name} is out of office with no delegate assigned`,
  }))
  startOp(mkOp({
    id: 'op-a2', workerId: aiByName('Sanctions-Review-004').id, requiredScope: 'sanctions:hold:release', amount: 64_000, status: 'awaiting_approval',
    startedAt: iso(NOW - 3 * DAY - 6 * HOUR), awaitingSince: iso(NOW - 3 * DAY - 6 * HOUR), severity: 'critical', decisionOwnerId: marcus.id,
    title: 'Release sanctions hold on 14 related accounts',
    summary: 'Screening found no match. Customers cannot transact until a reviewer releases the hold.',
    blockReason: 'Second reviewer sign-off has not been assigned',
  }))
  startOp(mkOp({
    id: 'op-a3', workerId: aiByName('Claims-Payout-009').id, requiredScope: 'claims:payout:approve', amount: 118_500, status: 'awaiting_approval',
    startedAt: iso(NOW - 4 * DAY), awaitingSince: iso(NOW - 4 * DAY), severity: 'high',
    title: 'Approve payout for claim CL-77412 (' + usd(118_500) + ')',
    summary: 'Documentation verified. Payout exceeds the approver’s delegated authority.',
    blockReason: 'Amount exceeds the approver’s delegated authority',
  }))

  // C: in-progress wire a manager can change permissions around
  const wireWorker = aiByName('Payments-Disburse-003')
  const opC = mkOp({
    id: 'op-c1', workerId: wireWorker.id, requiredScope: 'payments:wire:execute', amount: 480_000, status: 'in_progress',
    startedAt: iso(NOW - 3 * HOUR), severity: 'high', decisionOwnerId: priya.id,
    title: `Wire ${usd(480_000)} to Halden Freight Ltd`,
    summary: 'Invoice matched and beneficiary verified. The wire is staged and will execute on the next run.',
  })
  startOp(opC)

  // D1: limit tightened, then revoked mid-flight, execution prevented, later re-granted
  const d1 = aiByName('Payments-Disburse-011')
  const opD1 = mkOp({
    id: 'op-d1', workerId: d1.id, requiredScope: 'payments:wire:execute', amount: 120_000, status: 'in_progress',
    startedAt: iso(NOW - 30 * HOUR), severity: 'high', decisionOwnerId: priya.id,
    title: `Wire ${usd(120_000)} to Northwind Escrow`,
    summary: 'Escrow funding wire staged for the next run.',
  })
  permission(NOW - 9 * DAY, priya.name, d1.id, 'payments:wire:execute', 'modify', 'Quarterly limit review', 150_000)
  startOp(opD1)
  permission(NOW - 28 * HOUR, priya.name, d1.id, 'payments:wire:execute', 'revoke', 'Vendor placed under sanctions review')
  attempt(opD1, NOW - 27 * HOUR)
  permission(NOW - 20 * HOUR, priya.name, d1.id, 'payments:wire:execute', 'grant', 'Review cleared, access restored', 150_000)

  // D2: executed while authorized; revoked afterwards (must not rewrite the earlier outcome)
  const d2 = aiByName('Payments-Disburse-014')
  const opD2 = mkOp({
    id: 'op-d2', workerId: d2.id, requiredScope: 'payments:wire:execute', amount: 75_000, status: 'in_progress',
    startedAt: iso(NOW - 26 * HOUR), severity: 'medium', decisionOwnerId: priya.id,
    title: `Wire ${usd(75_000)} to Kestrel Logistics`,
    summary: 'Routine supplier payment.',
  })
  startOp(opD2)
  attempt(opD2, NOW - 26 * HOUR + 40 * MINUTE)
  permission(NOW - 20 * HOUR + 30 * MINUTE, priya.name, d2.id, 'payments:wire:execute', 'revoke', 'Agent retired for redesign')

  // D3: limit lowered below the amount before execution
  const d3 = aiByName('Claims-Payout-005')
  const claimsLead = leadOf('t-claims')
  const opD3 = mkOp({
    id: 'op-d3', workerId: d3.id, requiredScope: 'claims:payout:approve', amount: 140_000, status: 'in_progress',
    startedAt: iso(NOW - 20 * HOUR), severity: 'medium', decisionOwnerId: claimsLead.id,
    title: `Approve payout for claim CL-68801 (${usd(140_000)})`,
    summary: 'Payout recommended after adjuster review.',
  })
  permission(NOW - 6 * DAY, claimsLead.name, d3.id, 'claims:payout:approve', 'modify', 'Tighten limit after audit finding', 100_000)
  startOp(opD3)
  attempt(opD3, NOW - 19 * HOUR)

  // R1: authority at risk. The ledger limit was lowered below this in-flight amount after it started,
  // so it would be denied if it ran now. It has not been attempted, so there is no stored decision yet.
  const r1 = aiByName('Ledger-Adjust-002')
  const dana0 = human('Dana Whitfield')
  startOp(mkOp({
    id: 'op-r1', workerId: r1.id, requiredScope: 'ledger:adjust', amount: 140_000, status: 'in_progress',
    startedAt: iso(NOW - 6 * HOUR), severity: 'high', decisionOwnerId: dana0.id,
    title: `Post ledger adjustment ADJ-4417 (${usd(140_000)})`,
    summary: 'Month-end accrual correction prepared and staged for posting.',
  }))
  permission(NOW - 4 * HOUR, dana0.name, r1.id, 'ledger:adjust', 'modify', 'Lower limit pending audit review', 100_000)

  /* bulk operations */
  const scopes = Object.keys(SCOPES)
  const reserved = new Set(heroWorkerIds)
  let opSeq = 0
  scopes.forEach((scope, s) => {
    const pool = ai.filter((w) => fnOf.get(w.id)?.scope === scope && !heroWorkerIds.has(w.id))
    const [lo, hi] = SCOPE_AMOUNT[scope]
    const make = (status: 'in_progress' | 'awaiting_approval', startedAt: number, workerId: string): Operation => {
      const amount = round(rng.float(lo, hi), hi > 100_000 ? 500 : 50)
      const w = workers.find((x) => x.id === workerId)!
      const team = TEAM_SPECS.find((t) => t.id === w.teamId)!
      const ownerPool = workers.filter((x) => x.kind === 'human' && x.teamId === w.teamId)
      const num = ++opSeq
      const ratio = amount / SCOPE_LIMIT[scope]
      const daysBlocked = (NOW - startedAt) / DAY
      const blocked = status === 'awaiting_approval'
      const severity: Severity = blocked
        ? ratio >= 0.5 || daysBlocked >= 5 ? 'high' : ratio >= 0.2 ? 'medium' : 'low'
        : ratio >= 0.7 ? 'high' : ratio >= 0.25 ? 'medium' : 'low'
      return {
        id: `op-${pad(num)}`, workerId, requiredScope: scope, amount, status, severity, startedAt: iso(startedAt),
        decisionOwnerId: (blocked ? rng.pick(ownerPool) : leadOf(w.teamId)).id,
        awaitingSince: blocked ? iso(startedAt) : undefined,
        blockReason: blocked ? rng.pick(BLOCK_REASONS) : undefined,
        title: TITLE[scope](usd(amount), rng.int(1000, 9999), rng.pick(VENDORS)),
        summary: `${w.name} prepared this ${SCOPE_VERB[scope]} for ${team.name}.`,
      }
    }
    const executor = () => rng.pick(pool.filter((w) => !reserved.has(w.id)))

    // prevented: a dedicated worker whose scope is revoked before execution, then restored
    const pvWorker = executor()
    reserved.add(pvWorker.id)
    const pv = make('in_progress', NOW - rng.int(2, 20) * DAY - rng.int(0, 10) * HOUR, pvWorker.id)
    const owner = workers.find((w) => w.id === pv.decisionOwnerId)!
    const tRevoke = Date.parse(pv.startedAt) + rng.int(5, 60) * MINUTE
    startOp(pv)
    permission(tRevoke, owner.name, pvWorker.id, scope, 'revoke', rng.pick(['Control review in progress', 'Role under redesign', 'Incident follow-up']))
    attempt(pv, tRevoke + rng.int(5, 90) * MINUTE)
    permission(tRevoke + 4 * HOUR, owner.name, pvWorker.id, scope, 'grant', 'Access restored after review', SCOPE_LIMIT[scope])

    for (let i = 0; i < 5; i++) startOp(make('in_progress', NOW - rng.int(30, 60 * 60) * MINUTE, executor().id))
    for (let i = 0; i < (s < 4 ? 3 : 2); i++) startOp(make('awaiting_approval', NOW - rng.int(1, 8) * DAY - rng.int(0, 20) * HOUR, executor().id))
    for (let i = 0; i < (s < 6 ? 4 : 3); i++) {
      const op = make('in_progress', NOW - rng.int(1, 28) * DAY - rng.int(0, 20) * HOUR, executor().id)
      startOp(op)
      attempt(op, Date.parse(op.startedAt) + rng.int(10, 360) * MINUTE)
    }
  })

  /* resolved conflicts */
  const dana = human('Dana Whitfield')
  push(NOW - 5 * DAY, { type: 'RESOLVE_CONFLICT', at: iso(NOW - 5 * DAY), actor: dana.name, conflictId: 'c-006', authoritativeWorkerId: conflicts[5].workerAId, note: 'Refund-Issue-004 owns refund actioning; support worker only drafts.' })
  push(NOW - 7 * DAY, { type: 'RESOLVE_CONFLICT', at: iso(NOW - 7 * DAY), actor: dana.name, conflictId: 'c-007', authoritativeWorkerId: conflicts[6].workerBId, note: 'Exception triage takes precedence on failed batches.' })

  /* ---------- replay ---------- */
  let state: AppState = {
    teams, workers, values, operations: [], conflicts, concerns, events: [], nextSeq: 1,
    clock: iso(NOW - 41 * DAY), seedClock: iso(NOW), actingAs: { name: dana.name, role: 'executive' },
  }
  const ordered = steps.map((s, i) => ({ ...s, i })).sort((a, b) => a.at - b.at || a.i - b.i)
  for (const step of ordered) {
    const r = applyAction(state, step.action)
    if (!r.ok) throw new Error(`Fixture replay failed at ${step.action.type} (${step.action.at}): ${r.error}`)
    state = r.state
  }
  return { ...state, clock: iso(NOW), seedClock: iso(NOW) }
}

export function personasFor(state: AppState): Record<SimRole, Actor> {
  const name = (n: string) => state.workers.find((w) => w.name === n)!.name
  return {
    executive: { name: name('Dana Whitfield'), role: 'executive' },
    manager: { name: name('Priya Raman'), role: 'manager' },
    investigator: { name: name('Marcus Hale'), role: 'investigator' },
  }
}
