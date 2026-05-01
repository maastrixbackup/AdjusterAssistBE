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
    if (
      /convert(s|ed)?\s+(this\s+)?to\s+email/.test(text) ||
      /convert(s|ed)?\s+(this\s+)?into\s+email/.test(text) ||
      /create\s+(an?\s+)?email/.test(text) ||
      /write\s+(an?\s+)?email/.test(text) ||
      /draft\s+(an?\s+)?email/.test(text) ||
      /send\s+(an?\s+)?email/.test(text) ||
      /email\s+(this|it)/.test(text)
    ) {
      return { type: 'email_insured', confidence: 0.95, source: 'deterministic' };
    }

    if (
      text.includes("contractor response") ||
      text.includes("reply to contractor") ||
      text.includes("email contractor") ||
      text.includes("send to contractor") ||
      text.includes("to contractor") ||
      text.includes("vendor response")
    ) {
      return { type: 'email_contractor', confidence: 0.92, source: 'deterministic' };
    }
    // Explicit Denial/Coverage Triggers
    if (text.includes("not covered") || text.includes("denial") || text.includes("exclude")) {
      return { type: 'denial_support', confidence: 0.9, source: 'deterministic' };
    }

    if (text.includes("shingle count") || text.includes("line item") || text.includes("estimate dispute")) {
      return { type: 'supplement_response', confidence: 0.9, source: 'deterministic' };
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
      text.includes("initial") &&
      (text.includes("call") || text.includes("contact"))
    ) {
      return { type: 'first_contact_note', confidence: 0.96, source: 'deterministic' };
    }
    if (
      text.includes("initial contact") ||
      text.includes("initial claim") ||
      text.includes("first contact") ||
      text.includes("introduce myself") ||
      text.includes("introduced myself") ||
      text.includes("adjuster introduction") ||
      text.includes("initial claim call summary") ||

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


    if (text.includes("into a file note format")) {
      return { type: 'file_note', confidence: 0.95, source: 'deterministic' };
    }

    return null;
  }

  // LAYER 2: AI INTENT MAPPING (The Brain)
  async runAILayer(userInput) {
    const systemPrompt = `
You are an Insurance Claim Routing Engine. Your job is to classify the user's request into EXACTLY one output type with high accuracy.

You must prioritize USER INTENT (what they want to generate or convert) over raw content.

----------------------------------------
TYPES & INTENT (DO NOT MODIFY DEFINITIONS)
----------------------------------------
- file_note: Documenting general activity/internal logs.
- email_insured: Acknowledgements, updates, questions, or communication intended for the policyholder.
- email_contractor: Requests, responses, or communication intended for contractors, vendors, or mitigation teams.
- escalation_response: Handling complaints, dissatisfaction, or escalation scenarios.
- supplement_response: Reviewing estimates, supplements, pricing disputes, or scope disagreements.
- coverage_analysis: Internal policy reasoning about coverage decisions.
- denial_support: Formal reasoning supporting denial or partial denial.
- claim_summary: High-level recap of the claim.
- xactanalysis_response: Short, technical, operational notes for platforms/vendors.
- damage_evaluation: Inspection findings or observed damages.
- attorney_response: Formal, legally defensive communication to attorneys.
- fnol: First Notice of Loss; initial structured intake of a claim.
- inspection_summary: Structured inspection findings and observations.
- first_contact_note: Initial adjuster contact with insured including introduction, verification, reported damages, mitigation/inspection steps, and next actions.
- closing_note: Final internal documentation indicating claim closure, completion, denial, withdrawal, or no further action.

----------------------------------------
CRITICAL INTENT DETECTION RULES (HIGHEST PRIORITY)
----------------------------------------

1. CONVERSION / TRANSFORMATION INTENT (VERY IMPORTANT):
If the user says words like:
- "convert", "draft", "create", "rewrite", "make", "turn this into"

Then classify based on TARGET OUTPUT:

- "email", "send", "reply" → email_insured OR email_contractor depending on audience
- "contractor", "vendor" → email_contractor
- "insured", "policyholder" → email_insured
- "attorney", "counsel" → attorney_response
- "fnol" → fnol
- "inspection" → inspection_summary
- "closing" → closing_note
- "first contact" → first_contact_note

⚠️ NEVER default to file_note if a conversion intent is present.

----------------------------------------
AUDIENCE DETECTION (SECOND PRIORITY)
----------------------------------------

If the request implies communication:

- Mentions contractor/vendor/mitigation → email_contractor
- Mentions insured/policyholder/customer → email_insured
- Mentions attorney/law firm/counsel → attorney_response

Examples:
- "contractor response" → email_contractor
- "reply to insured" → email_insured
- "send to attorney" → attorney_response

----------------------------------------
SPECIALIZED HIGH-CONFIDENCE RULES
----------------------------------------

FIRST CONTACT NOTE:
If input includes:
- initial contact / first contact
- adjuster introduction
- verifying details (address, mortgagee, deductible)
- explaining next steps
- scheduling inspection
→ MUST classify as first_contact_note

CLOSING NOTE:
If input includes:
- close claim / ready to close
- no further action
- below deductible
- denial completed
- withdrawn / duplicate / no contact
→ MUST classify as closing_note

SUPPLEMENT:
If estimate, pricing, line items, or disputes mentioned → supplement_response

DENIAL:
If denial / not covered / excluded → denial_support

----------------------------------------
CONFLICT RESOLUTION RULES
----------------------------------------

1. Conversion intent ALWAYS overrides everything else
2. External communication ALWAYS overrides internal note
3. first_contact_note overrides file_note
4. closing_note overrides claim_summary
5. If still unclear → file_note

----------------------------------------
CONFIDENCE SCORING GUIDE
----------------------------------------
- 0.90–0.98 → explicit intent or keywords
- 0.75–0.89 → strong inferred intent
- 0.60–0.74 → weak but reasonable guess
- Default fallback → 0.70

----------------------------------------
RESPONSE FORMAT (STRICT JSON ONLY)
----------------------------------------
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