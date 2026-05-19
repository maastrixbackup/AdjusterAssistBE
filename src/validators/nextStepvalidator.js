const forbiddenTermsByAudience = {

  internal_file: [
    "contractor",
    "mitigation vendor",
    "repair vendor",
    "public adjuster",
    "attorney",
    "counsel",
  ],

  insured: [
    "litigation",
    "counsel",
    "attorney",
  ],

  public_adjuster: [
    "contractor submitted",
    "repair vendor",
  ],

  attorney: [
    "contractor estimate",
    "repair vendor",
  ],
};

const requiredTermsByAudience = {

  attorney: [
    "attorney",
    "counsel",
    "legal",
  ],

  public_adjuster: [
    "public adjuster",
    "supplement",
    "estimate",
  ],

  contractor: [
    "contractor",
    "estimate",
    "repair",
    "mitigation",
  ],
};

const validateNextStep = (
  nextStep,
  audienceType
) => {

  if (!nextStep) {
    return false;
  }

  const normalized =
    nextStep.toLowerCase();

  // ─────────────────────────────
  // FORBIDDEN TERM CHECK
  // ─────────────────────────────

  const forbiddenTerms =
    forbiddenTermsByAudience[
      audienceType
    ] || [];

  for (const term of forbiddenTerms) {

    if (normalized.includes(term)) {

      console.warn(
        `[NEXT STEP VALIDATOR] Forbidden term detected: ${term}`
      );

      return false;
    }
  }

  // ─────────────────────────────
  // REQUIRED TERM CHECK
  // ─────────────────────────────

  const requiredTerms =
    requiredTermsByAudience[
      audienceType
    ];

  // Only enforce if audience has requirements
  if (
    requiredTerms &&
    requiredTerms.length > 0
  ) {

    const hasRequiredTerm =
      requiredTerms.some(term =>
        normalized.includes(term)
      );

    if (!hasRequiredTerm) {

      console.warn(
        `[NEXT STEP VALIDATOR] Missing required audience reference`
      );

      return false;
    }
  }

  // ─────────────────────────────
  // LENGTH VALIDATION
  // ─────────────────────────────

  if (nextStep.length > 300) {

    console.warn(
      `[NEXT STEP VALIDATOR] Next step too long`
    );

    return false;
  }

  return true;
};

module.exports = {
  validateNextStep,
};