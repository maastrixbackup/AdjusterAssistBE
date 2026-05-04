import { generateFastClassification } from "./ai.service.js";

class ClassifierService {
  constructor() {
    this.OUTPUT_TYPES = [
      'file_note', 'email_insured', 'email_contractor',
      'escalation_response', 'supplement_response', 'coverage_analysis',
      'denial_support', 'claim_summary', 'xactanalysis_response', 'damage_evaluation',
      'attorney_response', 'fnol', 'inspection_summary', 'first_contact_note', 'closing_note', 'claim_guidance'
    ];
  }

  // LAYER 1: DETERMINISTIC (Fast, Non-AI)
  runDeterministicLayer(input) {
    const text = input.toLowerCase();

    // 🔥 XACTANALYSIS / PORTAL NOTE DETECTION (IMPROVED)
    if (
      // Direct keywords
      text.includes("xactanalysis") ||
      text.includes("xact analysis") ||
      text.includes("xactimate") ||
      text.includes("xa note") ||
      text.includes("xa update") ||

      // Portal / system note intent
      text.includes("portal note") ||
      text.includes("portal update") ||
      text.includes("add note to portal") ||
      text.includes("update portal") ||

      // Action-based detection
      (
        (text.includes("note") || text.includes("update")) &&
        (
          text.includes("xact") ||
          text.includes("xa") ||
          text.includes("estimate system") ||
          text.includes("carrier portal")
        )
      ) ||
      /\bxa\b/.test(text)
    ) {
      return { type: 'xactanalysis_response', confidence: 0.95, source: 'deterministic' };
    }

    // 🔥 HELP ROOM / GUIDANCE DETECTION (HIGHEST PRIORITY)
    if (
      text.includes("?") ||
      (
        text.includes("should i") ||
        text.includes("can i") ||
        text.includes("do i") ||
        text.includes("am i") ||
        text.includes("is it") ||
        text.includes("what should") ||
        text.includes("when should") ||
        text.includes("how should") ||
        text.includes("wait or") ||
        text.includes("or wait") ||
        text.includes("assign") ||
        text.includes("proceed") ||
        text.includes("next step") ||
        text.includes("what is best") ||
        text.includes("what is the next step") ||
        text.includes("guidance") ||
        text.includes("or should")
      )
    ) {
      return { type: 'claim_guidance', confidence: 0.98, source: 'deterministic' };
    }

    if (
      (
        text.includes("insured") ||
        text.includes("policyholder") ||
        text.includes("customer") ||
        text.includes("claimant")
      ) &&
      (
        text.includes("asked") ||
        text.includes("request") ||
        text.includes("requested") ||
        text.includes("wants") ||
        text.includes("needs") ||
        text.includes("follow up") ||
        text.includes("follow-up") ||
        text.includes("question") ||
        text.includes("update") ||
        text.includes("status") ||
        text.includes("called") ||
        text.includes("inquired") ||
        text.includes("checking")
      ) &&
      (
        text.includes("respond") ||
        text.includes("response") ||
        text.includes("reply") ||
        text.includes("email") ||
        text.includes("send") ||
        text.includes("create") ||
        text.includes("draft") ||
        text.includes("appropriate response")
      )
    ) {
      return { type: 'email_insured', confidence: 0.95, source: 'deterministic' };
    }


    // GENERIC EMAIL CONVERSION (SMART TARGETING)
    if (
      /convert(s|ed)?\s+(this\s+)?to\s+email/.test(text) ||
      /convert(s|ed)?\s+(this\s+)?into\s+email/.test(text) ||
      /create\s+(an?\s+)?email/.test(text) ||
      /write\s+(an?\s+)?email/.test(text) ||
      /draft\s+(an?\s+)?email/.test(text) ||
      /email\s+(to|for)\s+(the\s+)?insured/.test(text) ||
      /send\s+(an?\s+)?email\s+to\s+(the\s+)?insured/.test(text) ||
      /reply\s+to\s+(the\s+)?insured/.test(text) ||
      /respond\s+to\s+(the\s+)?insured/.test(text)
    ) {
      // If contractor context exists → contractor email
      if (
        text.includes("contractor") ||
        text.includes("vendor") ||
        text.includes("mitigation")
      ) {
        return { type: 'email_contractor', confidence: 0.95, source: 'deterministic' };
      }

      return { type: 'email_insured', confidence: 0.95, source: 'deterministic' };
    }

    // CONTRACTOR / VENDOR RESPONSE (ENHANCED)
    if (
      (text.includes("contractor") || text.includes("vendor") || text.includes("mitigation"))
    ) {
      let score = 0;

      // 🔹 Financial / estimate signals
      if (
        text.includes("estimate") ||
        text.includes("invoice") ||
        text.includes("scope") ||
        text.includes("pricing") ||
        text.includes("bid") ||
        text.includes("supplement")
      ) {
        score += 1;
      }

      // 🔹 Action / communication intent
      if (
        text.includes("respond") ||
        text.includes("response") ||
        text.includes("reply") ||
        text.includes("email") ||
        text.includes("send") ||
        text.includes("create") ||
        text.includes("draft") ||
        text.includes("appropriate response")
      ) {
        score += 1;
      }

      // 🔹 Submission / request signals
      if (
        text.includes("submitted") ||
        text.includes("requested") ||
        text.includes("provided") ||
        text.includes("sent")
      ) {
        score += 1;
      }

      if (score >= 2) {
        return { type: 'email_contractor', confidence: 0.95, source: 'deterministic' };
      }
    }


    if (text.includes("into a attorney response format") || text.includes("attorney") || text.includes("counsel") || text.includes("law firm") || text.includes("legal response") || text.includes("to attorney")) {
      return { type: 'attorney_response', confidence: 0.95, source: 'deterministic' };
    }

    if (text.includes("not covered") || text.includes("denial") || text.includes("exclude")) {
      return { type: 'denial_support', confidence: 0.9, source: 'deterministic' };
    }

    if (text.includes("to contractor") || text.includes("for contractor")) {
      return { type: 'email_contractor', confidence: 0.98, source: 'deterministic' };
    }

    if (
      text.includes("supplement") ||
      text.includes("public adjuster") ||
      text.includes("pa submitted") ||
      text.includes("pa request") ||
      text.includes("pa estimate") ||
      text.includes("contractor estimate") ||
      text.includes("supplement request") ||
      text.includes("revised estimate") ||
      text.includes("additional scope") ||
      text.includes("scope dispute") ||
      text.includes("dispute estimate") ||
      text.includes("pricing dispute") ||
      text.includes("full replacement") ||
      text.includes("replace entire") ||
      text.includes("requested full") ||
      text.includes("over scope") ||
      text.includes("shingle count") ||
      text.includes("line item") ||
      text.includes("beyond observed damage") ||
      text.includes("estimate exceeds")
    ) {
      return { type: 'supplement_response', confidence: 0.95, source: 'deterministic' };
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

    // SMART INFERENCE: "appropriate response" / "create response"
    if (text.includes("appropriate response") || text.includes("create the appropriate response") || text.includes("create response")) {
      // Contractor / Vendor present → email_contractor
      if (
        text.includes("contractor") ||
        text.includes("vendor") ||
        text.includes("mitigation")
      ) {
        return { type: 'email_contractor', confidence: 0.93, source: 'inferred' };
      }

      // Public Adjuster / Supplement context → supplement_response
      if (
        text.includes("public adjuster") ||
        text.includes("pa ") ||
        text.includes("supplement")
      ) {
        return { type: 'supplement_response', confidence: 0.93, source: 'inferred' };
      }

      // Insured → email_insured
      if (
        text.includes("insured") ||
        text.includes("policyholder") ||
        text.includes("customer")
      ) {
        return { type: 'email_insured', confidence: 0.9, source: 'inferred' };
      }
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
- claim_guidance: Adjuster help-room response where the user is asking a question or seeking guidance (e.g., "should I", "what should I do", "can I proceed"). This is NOT a drafting request.

----------------------------------------
CRITICAL INTENT DETECTION RULES (HIGHEST PRIORITY)
----------------------------------------
0. GUIDANCE / QUESTION INTENT (HIGHEST PRIORITY):
If the user is asking a question (contains "?" or phrases like "should I", "can I", "what should", "how should", "wait or", "proceed or"):
→ MUST classify as claim_guidance

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
If estimate, pricing, line items, suppliment or disputes mentioned → supplement_response

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