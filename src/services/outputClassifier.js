import { generateFastClassification } from "./ai.service.js";

class ClassifierService {
  constructor() {
    this.OUTPUT_TYPES = [
      'file_note', 'email_insured', 'email_contractor',
      'escalation_response', 'supplement_response', 'coverage_analysis',
      'denial_support', 'claim_summary', 'xactanalysis_response', 'damage_evaluation',
      'attorney_response', 'fnol', 'inspection_summary', 'first_contact_note', 'closing_note'
    ];
  }

  // LAYER 1: DETERMINISTIC (Fast, Non-AI)
  runDeterministicLayer(input) {
    const text = input.toLowerCase();

    if (text.includes("xactanalysis") || text.includes("portal note") || text.includes("xa")) {
      return { type: 'xactanalysis_response', confidence: 0.95, source: 'deterministic' };
    }

    // Explicit Denial/Coverage Triggers
    if (text.includes("not covered") || text.includes("denial") || text.includes("exclude")) {
      return { type: 'denial_support', confidence: 0.9, source: 'deterministic' };
    }

    if (text.includes("shingle count") || text.includes("line item") || text.includes("estimate dispute")) {
      return { type: 'supplement_response', confidence: 0.9, source: 'deterministic' };
    }

    if (text.includes("into a file note format")) {
      return { type: 'file_note', confidence: 0.95, source: 'deterministic' };
    }

    if (text.includes("into a attorney response format") || text.includes("attorney")) {
      return { type: 'attorney_response', confidence: 0.95, source: 'deterministic' };
    }

    if (text.includes("into a email format")) {
      return { type: 'email_insured', confidence: 0.9, source: 'deterministic' };
    }

    // FNOL triggers
    if (
      text.includes("fnol") ||
      text.includes("first notice of loss") ||
      text.includes("reported a loss") ||
      text.includes("initial report") ||
      text.includes("fnol") || text.includes("first notice of loss")
    ) {
      return { type: 'fnol', confidence: 0.9, source: 'deterministic' };
    }

    // Inspection Summary triggers
    if (
      text.includes("inspection summary") ||
      text.includes("inspected") ||
      text.includes("site inspection") ||
      text.includes("field inspection") ||
      text.includes("observed damage") ||
      text.includes("photos attached")
    ) {
      return { type: 'inspection_summary', confidence: 0.85, source: 'deterministic' };
    }

    // FIRST CONTACT NOTE triggers (STRICT CLIENT-DEFINED ONLY)
    if (
      text.includes("initial contact") ||
      text.includes("first contact") ||
      text.includes("introduce myself") ||
      text.includes("introduced myself") ||
      text.includes("adjuster introduction") ||

      text.includes("verify property address") ||
      text.includes("verified property address") ||
      text.includes("verifying property address") ||

      text.includes("verify mortgagee") ||
      text.includes("verified mortgagee") ||
      text.includes("lienholder") ||

      text.includes("reviewing deductible") ||
      text.includes("reviewed deductible") ||

      text.includes("reviewing payment method") ||
      text.includes("reviewed payment method") ||

      text.includes("describe damages") ||

      text.includes("explaining next steps") ||
      text.includes("explained next steps") ||

      text.includes("assigning mitigation") ||
      text.includes("assigned mitigation") ||

      text.includes("scheduling inspection") ||
      text.includes("scheduled inspection") ||

      text.includes("requesting photos") ||
      text.includes("requested photos") ||
      text.includes("requesting documents") ||
      text.includes("requested documents") ||
      text.includes("requesting estimate") ||
      text.includes("requested estimate") ||

      text.includes("coverage position pending initial review")
    ) {
      return { type: 'first_contact_note', confidence: 0.92, source: 'deterministic' };
    }

    // CLOSING NOTE triggers (STRICT CLIENT-DEFINED ONLY)
    if (
      text.includes("create closing note") ||

      text.includes("claim ready to close") ||
      text.includes("close the claim") ||

      text.includes("no further action") ||
      text.includes("no supplement pending") ||

      text.includes("repairs completed") ||

      text.includes("payment issued and claim complete") ||

      text.includes("below deductible") ||

      text.includes("denial completed") ||
      text.includes("partial denial completed") ||

      text.includes("withdrawn claim") ||

      text.includes("no contact closure") ||

      text.includes("insured not pursuing claim") ||

      text.includes("duplicate claim closed")
    ) {
      return { type: 'closing_note', confidence: 0.95, source: 'deterministic' };
    }

    return null;
  }

  // LAYER 2: AI INTENT MAPPING (The Brain)
  async runAILayer(userInput) {
    const systemPrompt = `
    You are an Insurance Claim Routing Engine. Categorize the input into EXACTLY one type and provide a confidence score.

    TYPES & INTENT:
    - file_note: Documenting general activity/internal logs.
    - email_insured: Acknoledgements, Updates or questions for the policyholder (Jhon, etc).
    - email_contractor: Requests for info or updates to builders/mitigation teams.
    - escalation_response: Handling complaints or angry insureds.
    - supplement_response: Reviewing estimates, shingle counts, or price disputes.
    - coverage_analysis: Legal/Policy reasoning for what is or isn't paid.
    - denial_support: Formal reasoning for a claim rejection.
    - claim_summary: A high-level recap of the whole file.
    - xactanalysis_response: Short, technical operational notes.
    - damage_evaluation: Findings from a physical inspection (roof, kitchen, etc).
    - attorney_response: Formal, defensible response to attorneys; no liability or coverage admissions.
    - fnol: First Notice of Loss; initial report capturing date, cause, reporter, and initial damages.
    - inspection_summary: Structured internal inspection findings including areas inspected, observed damages, cause assessment, and photos.
    - first_contact_note: Internal note documenting the adjuster’s initial contact with the insured after claim setup, including introduction, verification details, reported damages, mitigation or inspection actions, requested documents, explanation of next steps, and coverage pending initial review; not a general file note.
    - closing_note: Internal claim closing documentation used when the claim is ready to close or has reached a final status such as completed, denied, below deductible, withdrawn, duplicate, or no-contact; includes claim status, coverage position, payment or deductible status if available, outstanding items if any, and clear reason for closure; not a general file note.

    CONFLICT RESOLUTION RULES:
    1. If there is an external audience (Insured/Contractor) -> Prioritize EMAIL.
    2. If it mentions a Supplement/Estimate dispute -> prioritize supplement_response.
    3. If no clear match -> return file_note.
    4. If the input explicitly indicates initial or first contact with the insured and includes verification, next steps, or inspection scheduling, you MUST classify as first_contact_note and not file_note.
    5. If the input indicates claim completion, closure, denial completion, below deductible outcome, withdrawal, duplicate closure, or no further action, you MUST classify as closing_note and not file_note or claim_summary.

    RESPONSE FORMAT (STRICT JSON ONLY):
    {
      "type": "one_of_the_types",
      "confidence": number_between_0_and_1
    }

    RETURN ONLY JSON. NO EXPLANATION.
  `;

    try {
      const raw = await generateFastClassification(systemPrompt, userInput);

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {
          type: this.validateType(raw.trim()),
          confidence: 0.7,
          source: 'ai'
        };
      }

      return {
        type: this.validateType(parsed.type),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        source: 'ai'
      };

    } catch (error) {
      console.error("AI Classification Failed:", error);
      return { type: 'file_note', confidence: 0.5, source: 'fallback' };
    }
  }

  // LAYER 3: VALIDATION & FALLBACK
  validateType(type) {
    if (this.OUTPUT_TYPES.includes(type)) {
      return type;
    }
    return 'file_note';
  }

  /**
   * Main Entry Point
   */
  async classify(input) {
    if (!input || input.length < 5) {
      return { type: 'file_note', confidence: 0.4, source: 'fallback' };
    }

    // 1. Check Deterministic Rules
    const ruleMatch = this.runDeterministicLayer(input);
    if (ruleMatch) return ruleMatch;

    // 2. Run AI Layer
    const aiResult = await this.runAILayer(input);

    return aiResult;
  }
}

export default new ClassifierService();