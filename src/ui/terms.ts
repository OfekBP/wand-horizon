/**
 * The user-facing words that other code depends on: the product's questions and the labels of its main actions.
 * Components render them, and the demo script and the tests look elements up by them, so a rename is one edit
 * here and the demo cannot drift silently (tests/demo-integrity.test.tsx checks it against the real app).
 */
export const TERMS = {
  askStuck: 'Is anything stuck?',
  askSpend: 'Is the AI spend justified?',
  askAllowed: 'What was the AI allowed to do?',
  investigateUrgent: 'Investigate the most urgent',
  reviewSpend: 'Review the spend',
  whoToReview: 'See who to review',
  replayIncident: 'Replay a past incident',
  moveDecision: 'Move the decision',
  runStep: 'Run execution step',
  changePermissions: 'Change permissions',
  revoke: 'Revoke',
  next: 'Next',
} as const

export const pauseWorkers = (n: number) => `Pause ${n} workers`
