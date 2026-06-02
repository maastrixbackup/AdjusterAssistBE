import { generateFastClassification } from "./ai.service.js";

class ClassifierService {
  constructor() {
    this.OUTPUT_TYPES = [
      'file_note', 'email_insured', 'email_contractor',
      'escalation_response', 'supplement_response', 'coverage_analysis',
      'denial_support', 'claim_summary', 'xactanalysis_response', 'damage_evaluation',
      'attorney_response', 'fnol', 'inspection_summary', 'first_contact_note',
      'closing_note', 'claim_guidance'
    ];
  }

  // ─── LAYER 1: DETERMINISTIC ────────────────────────────────────────────────
  // Priority order matters — most specific checks FIRST, broad checks LAST
  runDeterministicLayer(input) {
    const text = input.toLowerCase().trim();

    const hasEmailIntent =
      text.includes("email") ||
      text.includes("reply") ||
      text.includes("respond") ||
      text.includes("send") ||
      text.includes("draft") ||
      text.includes("write") ||
      text.includes("create");

    const hasConversionIntent =
      text.includes("convert") ||
      text.includes("into") ||
      text.includes("make") ||
      text.includes("turn");

    const isContractor =
      text.includes("contractor") ||
      text.includes("vendor") ||
      text.includes("mitigation");

    const isInsured =
      text.includes("insured") ||
      text.includes("policyholder") ||
      text.includes("customer") ||
      text.includes("client") ||
      text.includes("claimant");

    const isAttorney =
      text.includes("attorney") ||
      text.includes("law firm") ||
      /\bcounsel\b/.test(text);


    // ── 0. CALL TRANSCRIPT / CALL RECAP INTENT LOCK ─────────────────────
    // Must run before contractor/email rules.

    const isCallTranscript =
      text.includes("this is ") ||
      text.includes("i'm returning your call") ||
      text.includes("im returning your call") ||
      text.includes("thanks for calling back") ||
      text.includes("i spoke with") ||
      text.includes("spoke with") ||
      text.includes("insured advised") ||
      text.includes("caller stated") ||
      text.includes("she said") ||
      text.includes("he said") ||
      text.includes("during the call") ||
      text.includes("i explained") ||
      text.includes("i advised") ||
      text.includes("they will submit") ||
      text.includes("i'll follow up") ||
      text.includes("ill follow up") ||
      text.includes("voicemail") ||
      text.includes("call summary") ||
      text.includes("call recap") ||
      text.includes("phone conversation") ||
      text.includes("phone call");

    const wantsCallDocumentation =
      text.includes("document this conversation") ||
      text.includes("summarize the call") ||
      text.includes("summarise the call") ||
      text.includes("document the call") ||
      text.includes("create a note") ||
      text.includes("create note") ||
      text.includes("call note") ||
      text.includes("file note") ||
      text.includes("document this call") ||
      text.includes("summarize this conversation");

    const wantsInsuredEmail =
      text.includes("draft an email to the insured") ||
      text.includes("send recap email") ||
      text.includes("create insured email") ||
      text.includes("email the insured") ||
      text.includes("recap email to the insured") ||
      text.includes("send email to insured");

    const wantsContractorEmail =
      text.includes("respond to contractor") ||
      text.includes("email contractor") ||
      text.includes("email to contractor") ||
      text.includes("send to contractor") ||
      text.includes("reply to contractor");

    const wantsAttorneyResponse =
      text.includes("response to counsel") ||
      text.includes("respond to counsel") ||
      text.includes("draft a response to counsel") ||
      text.includes("response to attorney") ||
      text.includes("respond to attorney");

    if (isCallTranscript) {
      // Highest priority inside transcript: explicit documentation intent
      if (wantsCallDocumentation) {
        return { type: "file_note", confidence: 0.98, source: "call_transcript" };
      }

      // Explicit external-output intent
      if (wantsInsuredEmail) {
        return { type: "email_insured", confidence: 0.97, source: "call_transcript" };
      }

      if (wantsContractorEmail) {
        return { type: "email_contractor", confidence: 0.97, source: "call_transcript" };
      }

      if (wantsAttorneyResponse) {
        return { type: "attorney_response", confidence: 0.97, source: "call_transcript" };
      }

      // If conversation is clearly with contractor AND user asks for email/response
      if (
        (text.includes("contractor called") || text.includes("spoke with contractor")) &&
        (text.includes("email") || text.includes("respond") || text.includes("reply"))
      ) {
        return { type: "email_contractor", confidence: 0.94, source: "call_transcript" };
      }

      // If conversation is clearly with insured and user asks for email
      if (
        (
          text.includes("insured") ||
          text.includes("policyholder") ||
          text.includes("claimant") ||
          text.includes("member")
        ) &&
        text.includes("email")
      ) {
        return { type: "email_insured", confidence: 0.94, source: "call_transcript" };
      }

      // Safe default for call transcripts
      return { type: "file_note", confidence: 0.95, source: "call_transcript" };
    }

    // ── 1. ATTORNEY ─────────────────────────────────────────
    if (
      text.includes("into a attorney response format") ||
      text.includes("attorney response") ||
      text.includes("into attorney") ||
      text.includes("legal response") ||
      text.includes("to attorney") ||
      text.includes("send to attorney") ||
      text.includes("law firm") ||
      /\bcounsel\b/.test(text)
    ) {
      return { type: 'attorney_response', confidence: 0.97, source: 'deterministic' };
    }

    // ── 2. XACT ─────────────────────────────────────────────
    if (
      text.includes("xactanalysis") ||
      text.includes("xact analysis") ||
      text.includes("xactimate") ||
      text.includes("xa note") ||
      text.includes("xa update") ||
      text.includes("portal note") ||
      text.includes("portal update") ||
      text.includes("add note to portal") ||
      text.includes("update portal") ||
      text.includes("carrier portal") ||
      text.includes("estimate system") ||
      /\bxa\b/.test(text)
    ) {
      return { type: 'xactanalysis_response', confidence: 0.95, source: 'deterministic' };
    }

    // ── 3. FNOL ─────────────────────────────────────────────
    if (
      text.includes("fnol") ||
      text.includes("first notice of loss") ||
      text.includes("reported a loss") ||
      text.includes("initial report of loss")
    ) {
      return { type: 'fnol', confidence: 0.95, source: 'deterministic' };
    }

    // ── 4. DENIAL ───────────────────────────────────────────
    if (
      text.includes("denial letter") ||
      text.includes("denial support") ||
      text.includes("partial denial") ||
      text.includes("not covered") ||
      text.includes("coverage denial") ||
      (text.includes("denial") && (text.includes("draft") || text.includes("create") || text.includes("write")))
    ) {
      return { type: 'denial_support', confidence: 0.92, source: 'deterministic' };
    }

    // ── 5. SUPPLEMENT ───────────────────────────────────────
    if (
      text.includes("supplement request") ||
      text.includes("supplement response") ||
      text.includes("revised estimate") ||
      text.includes("additional scope") ||
      text.includes("scope dispute") ||
      text.includes("dispute estimate") ||
      text.includes("pricing dispute") ||
      text.includes("line item dispute") ||
      text.includes("shingle count") ||
      text.includes("beyond observed damage") ||
      text.includes("estimate exceeds") ||
      text.includes("over scope") ||
      text.includes("public adjuster") ||
      text.includes("pa submitted") ||
      text.includes("pa request") ||
      text.includes("pa estimate") ||
      (text.includes("supplement") && (text.includes("respond") || text.includes("draft") || text.includes("create")))
    ) {
      return { type: 'supplement_response', confidence: 0.95, source: 'deterministic' };
    }

    // ── 6. CLOSING NOTE ─────────────────────────────────────
    if (
      text.includes("create closing note") ||
      text.includes("create closing") ||
      text.includes("closing note") ||
      text.includes("close claim") ||
      text.includes("claim ready to close") ||
      text.includes("close the claim") ||
      text.includes("no further action") ||
      text.includes("no supplement pending") ||
      text.includes("repairs completed") ||
      text.includes("payment issued and claim complete") ||
      text.includes("below deductible") ||
      text.includes("denial completed") ||
      text.includes("withdrawn claim") ||
      text.includes("no contact closure") ||
      text.includes("insured not pursuing claim") ||
      text.includes("duplicate claim closed")
    ) {
      return { type: 'closing_note', confidence: 0.95, source: 'deterministic' };
    }

    // ── 7. FIRST CONTACT ────────────────────────────────────
    if (
      text.includes("first contact note") ||
      text.includes("initial contact note") ||
      text.includes("first contact") ||
      text.includes("initial contact") ||
      text.includes("adjuster introduction") ||
      text.includes("introduce myself") ||
      text.includes("introduced myself") ||
      text.includes("initial claim call") ||
      text.includes("verify mortgagee") ||
      text.includes("verified mortgagee") ||
      text.includes("lienholder") ||
      text.includes("reviewing deductible") ||
      text.includes("reviewed deductible") ||
      text.includes("reviewing payment method") ||
      text.includes("coverage position pending initial review") ||
      (text.includes("initial") && (text.includes("call") || text.includes("contact")))
    ) {
      return { type: 'first_contact_note', confidence: 0.95, source: 'deterministic' };
    }

    // ── 8. INSPECTION ───────────────────────────────────────
    if (
      text.includes("inspection summary") ||
      text.includes("site inspection") ||
      text.includes("field inspection") ||
      text.includes("observed damage") ||
      text.includes("photos attached") ||
      (text.includes("inspected") && (text.includes("property") || text.includes("damage") || text.includes("roof") || text.includes("site")))
    ) {
      return { type: 'inspection_summary', confidence: 0.90, source: 'deterministic' };
    }

    // ── 9. DAMAGE EVALUATION ────────────────────────────────
    if (
      text.includes("damage evaluation") ||
      text.includes("damage assessment") ||
      text.includes("evaluate damage") ||
      text.includes("assess damage")
    ) {
      return { type: 'damage_evaluation', confidence: 0.90, source: 'deterministic' };
    }

    // ── 10. EMAIL CONTRACTOR (BOOSTED) ──────────────────────
    if (
      text.includes("to contractor") ||
      text.includes("for contractor") ||
      text.includes("email contractor") ||
      /email\s+(to\s+)?(the\s+)?contractor/.test(text) ||
      /reply\s+to\s+(the\s+)?contractor/.test(text) ||
      /respond\s+to\s+(the\s+)?contractor/.test(text) ||
      /draft\s+(an?\s+)?email\s+(to\s+)?(the\s+)?contractor/.test(text) ||
      (isContractor && hasEmailIntent) // 🔥 NEW BOOST
    ) {
      return { type: 'email_contractor', confidence: 0.97, source: 'deterministic' };
    }

    // ── 11. EMAIL CONTRACTOR (score logic - kept same) ──────
    if (isContractor) {
      let score = 0;
      if (text.includes("estimate") || text.includes("invoice") || text.includes("scope") || text.includes("bid")) score++;
      if (text.includes("respond") || text.includes("response") || text.includes("reply") || text.includes("email") || text.includes("draft") || text.includes("create")) score++;
      if (text.includes("submitted") || text.includes("requested") || text.includes("provided") || text.includes("sent")) score++;

      if (score >= 2) {
        return { type: 'email_contractor', confidence: 0.92, source: 'deterministic' };
      }
    }

    // ── 12. EMAIL INSURED (BOOSTED) ─────────────────────────
    if (
      /email\s+(to\s+)?(the\s+)?insured/.test(text) ||
      /send\s+(an?\s+)?email\s+to\s+(the\s+)?insured/.test(text) ||
      /reply\s+to\s+(the\s+)?insured/.test(text) ||
      /respond\s+to\s+(the\s+)?insured/.test(text) ||
      /draft\s+(an?\s+)?email\s+(to\s+)?(the\s+)?insured/.test(text) ||
      /create\s+(an?\s+)?email\s+(to\s+)?(the\s+)?insured/.test(text) ||
      /write\s+(an?\s+)?email\s+(to\s+)?(the\s+)?insured/.test(text) ||
      text.includes("into a email format") ||
      text.includes("into an email format") ||
      /convert(s|ed)?\s+(this\s+)?to\s+email/.test(text) ||
      /convert(s|ed)?\s+(this\s+)?into\s+(an?\s+)?email/.test(text) ||
      (isInsured && hasEmailIntent) // 🔥 NEW BOOST
    ) {
      return { type: 'email_insured', confidence: 0.95, source: 'deterministic' };
    }

    // ── 13. COVERAGE ────────────────────────────────────────
    if (
      text.includes("coverage analysis") ||
      text.includes("policy analysis") ||
      text.includes("analyze coverage") ||
      text.includes("coverage position") ||
      text.includes("policy language")
    ) {
      return { type: 'coverage_analysis', confidence: 0.90, source: 'deterministic' };
    }

    // ── 14. CLAIM SUMMARY ───────────────────────────────────
    if (
      text.includes("claim summary") ||
      text.includes("summarize the claim") ||
      text.includes("summary of the claim") ||
      text.includes("claim recap")
    ) {
      return { type: 'claim_summary', confidence: 0.90, source: 'deterministic' };
    }

    // ── 15. ESCALATION ──────────────────────────────────────
    if (
      text.includes("escalation") ||
      text.includes("complaint") ||
      text.includes("dissatisfied") ||
      text.includes("threatening to sue") ||
      text.includes("department of insurance")
    ) {
      return { type: 'escalation_response', confidence: 0.90, source: 'deterministic' };
    }

    // ── 16. CLAIM GUIDANCE ──────────────────────────────────
    if (
      /\bshould i\b/.test(text) ||
      /\bcan i\b/.test(text) ||
      /\bdo i\b/.test(text) ||
      /\bam i\b/.test(text) ||
      /\bwhat should i\b/.test(text) ||
      /\bhow should i\b/.test(text) ||
      /\bwhat is the next step\b/.test(text) ||
      (text.includes("?") && (text.includes("should") || text.includes("is this") || text.includes("guidance") || text.includes("proceed")))
    ) {
      return { type: 'claim_guidance', confidence: 0.95, source: 'deterministic' };
    }

    // ── 17. FINAL SAFETY NET (🔥 CRITICAL FIX)
    if (hasEmailIntent) {
      if (isContractor) return { type: 'email_contractor', confidence: 0.85, source: 'fallback' };
      if (isAttorney) return { type: 'attorney_response', confidence: 0.85, source: 'fallback' };
      if (isInsured) return { type: 'email_insured', confidence: 0.85, source: 'fallback' };

      return { type: 'email_insured', confidence: 0.8, source: 'fallback' };
    }

    return null;
  }

  // ─── SMART FALLBACK (POST-AI CORRECTION) ───────────────────────────────
  smartFallback(input, aiResult) {
    const text = input.toLowerCase();

    // If AI already gave strong non-file_note → trust it
    if (aiResult.type !== 'file_note' && aiResult.confidence >= 0.75) {
      console.log("[TYPE]: ", aiResult.type)
      return aiResult;
    }

    if (
      text.includes("email") ||
      text.includes("reply") ||
      text.includes("respond") ||
      text.includes("send") ||
      text.includes("draft") ||
      text.includes("write")
    ) {
      if (
        text.includes("contractor") ||
        text.includes("vendor") ||
        text.includes("mitigation")
      ) {
        return { type: 'email_contractor', confidence: 0.85, source: 'fallback' };
      }

      if (
        text.includes("insured") ||
        text.includes("policyholder") ||
        text.includes("customer") ||
        text.includes("claimant")
      ) {
        return { type: 'email_insured', confidence: 0.85, source: 'fallback' };
      }
    }

    // SUPPLEMENT CONTEXT GUARD
    if (
      text.includes("supplement") ||
      text.includes("estimate") ||
      text.includes("scope") ||
      text.includes("line item") ||
      text.includes("pricing")
    ) {
      return { type: 'supplement_response', confidence: 0.82, source: 'fallback' };
    }

    // ATTORNEY GUARD
    if (
      text.includes("attorney") ||
      text.includes("counsel") ||
      text.includes("law firm")
    ) {
      return { type: 'attorney_response', confidence: 0.85, source: 'fallback' };
    }

    // GUIDANCE GUARD (question missed by AI)
    if (
      /\bshould i\b|\bcan i\b|\bwhat should\b|\bhow do i\b|\bis this\b|\?/.test(text)
    ) {
      return { type: 'claim_guidance', confidence: 0.80, source: 'fallback' };
    }

    // Final fallback
    return aiResult;
  }


  // ─── LAYER 2: AI INTENT MAPPING ───────────────────────────────────────────
  async runAILayer(userInput) {
    const systemPrompt = `
You are a STRICT Insurance Claim Routing Engine.

Your job: classify the user's request into EXACTLY ONE type with HIGH PRECISION.

----------------------------------------
OUTPUT TYPES (DO NOT CHANGE)
----------------------------------------
- file_note
- email_insured
- email_contractor
- escalation_response
- supplement_response
- coverage_analysis
- denial_support
- claim_summary
- xactanalysis_response
- damage_evaluation
- attorney_response
- fnol
- inspection_summary
- first_contact_note
- closing_note
- claim_guidance

----------------------------------------
CRITICAL DECISION LOGIC (FOLLOW IN ORDER)
----------------------------------------

1. QUESTION / GUIDANCE (HIGHEST PRIORITY)
If user is asking:
- contains "?"
- or phrases like "should I", "can I", "what should", "how do I"
→ RETURN: claim_guidance

----------------------------------------

2. CONVERSION / DRAFTING INTENT (VERY IMPORTANT)
If user says:
"create", "draft", "write", "convert", "make", "turn this into"

Then classify based on TARGET:

- mentions contractor/vendor/mitigation → email_contractor
- mentions insured/policyholder/customer → email_insured
- mentions attorney/counsel/law firm → attorney_response
- mentions inspection → inspection_summary
- mentions closing → closing_note
- mentions first contact → first_contact_note

NEVER return file_note if drafting intent exists

----------------------------------------

3. CALL TRANSCRIPT RULE:

If input appears to be a call recap, voicemail, phone conversation, or transcript, classify by the user's requested output.

- "document this conversation", "summarize the call", "document the call", "call note", "file note", "create a note" → file_note
- "draft email to insured", "send recap email", "email the insured", "create insured email" → email_insured
- "respond to contractor", "email contractor", "reply to contractor" → email_contractor
- "respond to counsel/attorney" → attorney_response

Important:
Mentioning contractor estimate, contractor documentation, mitigation invoice, or repair estimate does NOT mean email_contractor.
For call transcripts, default to file_note unless external email intent is clearly requested.

----------------------------------------

4. AUDIENCE DETECTION (EXTERNAL COMMUNICATION)
If communication is implied:

- contractor/vendor → email_contractor
- insured/policyholder → email_insured
- attorney → attorney_response

----------------------------------------

5. SPECIALIZED TYPES

- supplement / estimate dispute / PA → supplement_response
- denial / not covered → denial_support
- coverage reasoning → coverage_analysis
- inspection / observed damage → inspection_summary
- Xact / portal note → xactanalysis_response

----------------------------------------

6. FALLBACK RULE
Only return file_note if:
- no audience
- no drafting intent
- no question
- purely internal log

----------------------------------------

7. CONFIDENCE RULES:
- Clear intent → 0.90+
- Strong inference → 0.75–0.89
- Weak guess → 0.60–0.74

----------------------------------------

RETURN STRICT JSON ONLY:
{"type":"one_of_the_types","confidence":0.00}
`;

    try {
      const raw = await generateFastClassification(systemPrompt, userInput);

      // ── CLEAN RESPONSE ─────────────────────────────
      let cleaned = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      // Extract JSON safely (supports nested junk)
      const match = cleaned.match(/\{[\s\S]*?"type"\s*:\s*".+?"[\s\S]*?\}/);

      if (!match) {
        console.warn("[Classifier] No JSON found:", raw);
        return this.smartFallback(userInput, { type: 'file_note', confidence: 0.5 });
      }

      let parsed;
      try {
        parsed = JSON.parse(match[0]);
      } catch (err) {
        console.warn("[Classifier] JSON parse failed:", match[0]);
        return this.smartFallback(userInput, { type: 'file_note', confidence: 0.5 });
      }

      const type = this.validateType(parsed.type);

      const confidence =
        typeof parsed.confidence === "number"
          ? Math.min(Math.max(parsed.confidence, 0), 1)
          : 0.75;

      console.log(
        `[Classifier] AI result: ${type} (${confidence}) | "${userInput.slice(0, 80)}"`
      );

      return { type, confidence, source: "ai" };

    } catch (error) {
      console.error("[Classifier] AI layer error:", error);
      return this.smartFallback(userInput, { type: 'file_note', confidence: 0.5 });
    }
  }

  // ─── LAYER 3: VALIDATION ──────────────────────────────────────────────────
  validateType(type) {
    if (typeof type === 'string' && this.OUTPUT_TYPES.includes(type.trim())) {
      return type.trim();
    }
    console.warn(`[Classifier] Invalid type received: "${type}", falling back to file_note`);
    return 'file_note';
  }

  // ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────
  async classify(input) {
    if (!input || typeof input !== 'string' || input.trim().length < 5) {
      return { type: 'file_note', confidence: 0.4, source: 'fallback' };
    }

    const trimmedInput = input.trim();
    console.log(`[Classifier] Input: "${trimmedInput.slice(0, 80)}..."`);

    // Layer 1: Deterministic
    const ruleMatch = this.runDeterministicLayer(trimmedInput);
    if (ruleMatch) {
      console.log(`[Classifier] Deterministic hit: ${ruleMatch.type} (${ruleMatch.confidence})`);
      return ruleMatch;
    }

    // Layer 2: AI
    console.log(`[Classifier] No deterministic match, calling AI...`);
    const aiResult = await this.runAILayer(trimmedInput);
    console.log(aiResult)

    // 🧠 Apply smart correction layer
    const finalResult = this.smartFallback(trimmedInput, aiResult);

    console.log(`[Classifier] Final result: ${finalResult.type} (${finalResult.confidence})`);

    return finalResult;
  }
}

export default new ClassifierService();


export const resolveEmailType = ({
  userInput = "",
  originalResponse = ""
}) => {

  const text = `
    ${userInput}
    ${originalResponse}
  `.toLowerCase();
  // ─────────────────────────────────────────────
  // Core Intent Flags
  // ─────────────────────────────────────────────

  const hasEmailIntent =
    text.includes("email") ||
    text.includes("reply") ||
    text.includes("respond") ||
    text.includes("draft") ||
    text.includes("send") ||
    text.includes("write") ||
    text.includes("forward") ||
    text.includes("message");

  const isContractor =
    text.includes("contractor") ||
    text.includes("mitigation") ||
    text.includes("roofer") ||
    text.includes("vendor") ||
    text.includes("plumber") ||
    text.includes("restoration company") ||
    text.includes("restoration vendor") ||
    text.includes("water mitigation") ||
    text.includes("dry out company") ||
    text.includes("reconstruction company") ||
    text.includes("repair company");

  const isInsured =
    text.includes("insured") ||
    text.includes("policyholder") ||
    text.includes("customer") ||
    text.includes("homeowner") ||
    text.includes("tenant") ||
    text.includes("claimant");

  // ─────────────────────────────────────────────
  // 1. HARD CONTRACTOR EMAIL TRIGGERS
  // ─────────────────────────────────────────────

  if (
    text.includes("to contractor") ||
    text.includes("for contractor") ||
    text.includes("email contractor") ||
    text.includes("contractor email") ||
    text.includes("send to contractor") ||
    text.includes("reply contractor") ||
    text.includes("respond contractor") ||

    /email\s+(to\s+)?(the\s+)?contractor/.test(text) ||
    /reply\s+to\s+(the\s+)?contractor/.test(text) ||
    /respond\s+to\s+(the\s+)?contractor/.test(text) ||
    /draft\s+(an?\s+)?email\s+(to\s+)?(the\s+)?contractor/.test(text) ||
    /create\s+(an?\s+)?email\s+(to\s+)?(the\s+)?contractor/.test(text) ||
    /send\s+(an?\s+)?email\s+(to\s+)?(the\s+)?contractor/.test(text) ||

    /email\s+(to\s+)?(the\s+)?vendor/.test(text) ||
    /reply\s+to\s+(the\s+)?vendor/.test(text) ||
    /respond\s+to\s+(the\s+)?vendor/.test(text) ||

    /email\s+(to\s+)?(the\s+)?roofer/.test(text) ||
    /reply\s+to\s+(the\s+)?roofer/.test(text) ||

    /email\s+(to\s+)?(the\s+)?mitigation/.test(text) ||
    /reply\s+to\s+(the\s+)?mitigation/.test(text) ||

    (isContractor && hasEmailIntent)
  ) {
    return {
      type: "email_contractor",
      confidence: 0.97,
      source: "deterministic"
    };
  }

  // ─────────────────────────────────────────────
  // 2. CONTRACTOR SCORE ENGINE
  // ─────────────────────────────────────────────

  if (isContractor) {

    let score = 0;

    if (
      text.includes("estimate") ||
      text.includes("invoice") ||
      text.includes("scope") ||
      text.includes("bid") ||
      text.includes("supplement") ||
      text.includes("photos") ||
      text.includes("repair") ||
      text.includes("mitigation") ||
      text.includes("water extraction") ||
      text.includes("dry out") ||
      text.includes("rebuild")
    ) score++;

    if (
      text.includes("respond") ||
      text.includes("response") ||
      text.includes("reply") ||
      text.includes("email") ||
      text.includes("draft") ||
      text.includes("create") ||
      text.includes("send") ||
      text.includes("forward")
    ) score++;

    if (
      text.includes("submitted") ||
      text.includes("requested") ||
      text.includes("provided") ||
      text.includes("sent") ||
      text.includes("pending") ||
      text.includes("review") ||
      text.includes("approval")
    ) score++;

    if (score >= 2) {
      return {
        type: "email_contractor",
        confidence: 0.92,
        source: "score_engine"
      };
    }
  }

  // ─────────────────────────────────────────────
  // 3. INSURED EMAIL
  // ─────────────────────────────────────────────

  if (
    /email\s+(to\s+)?(the\s+)?insured/.test(text) ||
    /reply\s+to\s+(the\s+)?insured/.test(text) ||
    /respond\s+to\s+(the\s+)?insured/.test(text) ||
    /email\s+(to\s+)?(the\s+)?policyholder/.test(text) ||
    /reply\s+to\s+(the\s+)?policyholder/.test(text) ||
    /email\s+(to\s+)?(the\s+)?homeowner/.test(text) ||
    (isInsured && hasEmailIntent)
  ) {
    return {
      type: "email_insured",
      confidence: 0.94,
      source: "deterministic"
    };
  }

  // ─────────────────────────────────────────────
  // 4. SAFE FALLBACK
  // ─────────────────────────────────────────────

  if (isContractor) {
    return {
      type: "email_contractor",
      confidence: 0.75,
      source: "fallback_contractor_bias"
    };
  }

  return {
    type: "email_insured",
    confidence: 0.60,
    source: "fallback"
  };
};