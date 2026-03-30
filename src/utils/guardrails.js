

const GUARDRAIL_MAP = [
  {
    triggers: ['disposal', 'dumpster', 'pack-out', 'contents', 'discard'],
    injection: "Include preservation language; explicitly request photos/inventory. Use conditional wording for pack-outs and state that disposal is pending carrier verification."
  },
  {
    triggers: ['mitigation', 'drying', 'emergency services', 'water extraction'],
    injection: "Clarify that vendor recommendations are pending inspection/report. Avoid broad approval phrasing for scope of mitigation."
  },
  {
    triggers: ['mold', 'odor', 'mildew', 'fungus'],
    injection: "Use evaluation and salvageability language. Maintain a clear distinction between reported symptoms and verified laboratory findings."
  },
  {
    triggers: ['emergency repairs', 'tarping', 'board-up'],
    injection: "Advise that repairs must be 'reasonable and necessary.' Request invoice and photo documentation before reimbursement consideration."
  },
  {
    triggers: ['vendor recommended', 'contractor said', 'estimate from'],
    injection: "Identify the source as vendor-reported only. Explicitly state that the scope remains subject to internal carrier review."
  },
  {
    triggers: ['unclear', 'investigation', 'unknown cause'],
    injection: "Use pending verification wording. Avoid any definitive conclusions or premature finality regarding coverage or scope."
  },
  {
    triggers: ['prior damage', 'wear and tear', 'pre-existing', 'separate date'],
    injection: "Segregate these issues from the current claim. Do not blend unrelated damages; use separate evaluation language for non-loss related items."
  }
];

/**
 * Scans the user input and returns a string of protective language to inject.
 */
export const getAppliedGuardrails = (scenarioText) => {
  if (!scenarioText) return "";

  const lowerText = scenarioText.toLowerCase();
  const activeInjections = GUARDRAIL_MAP
    .filter(item => item.triggers.some(t => lowerText.includes(t)))
    .map(item => item.injection);

  if (activeInjections.length === 0) return "";

  return `\n\n[PROTECTIVE GUARDRAILS APPLIED]:\n${activeInjections.join("\n")}`;
};