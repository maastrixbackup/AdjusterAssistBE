import { generateFastClassification } from "./ai.service.js";

class ClassifierService {
  constructor() {
    this.OUTPUT_TYPES = [
      'file_note', 'email_insured', 'email_contractor', 
      'escalation_response', 'supplement_response', 'coverage_analysis', 
      'denial_support', 'claim_summary', 'xactanalysis_response', 'damage_evaluation',
      'attorney_response'
    ];
  }

  // LAYER 1: DETERMINISTIC (Fast, Non-AI)
  runDeterministicLayer(input) {
    const text = input.toLowerCase();

    // Specific Platform Triggers
    if (text.includes("xactanalysis") || text.includes("portal note") || text.includes("xa")) return 'xactanalysis_response';
    
    // Explicit Denial/Coverage Triggers
    if (text.includes("not covered") || text.includes("denial") || text.includes("exclude")) {
        return 'denial_support';
    }

    if (text.includes("shingle count") || text.includes("line item") || text.includes("estimate dispute")) {
        return 'supplement_response';
    }

    if (text.includes("into a file note format")) return 'file_note'
    if (text.includes("into a attorney response format")) return 'attorney_response'
    if (text.includes("into a email format")) return 'email_insured'

    return null; 
  }

  // LAYER 2: AI INTENT MAPPING (The Brain)
  async runAILayer(userInput) {
    const systemPrompt = `
      You are an Insurance Claim Routing Engine. Categorize the input into EXACTLY one type.
      
      TYPES & INTENT:
      - file_note: Documenting general activity/internal logs.
      - email_insured: Updates or questions for the policyholder (Jhon, etc).
      - email_contractor: Requests for info or updates to builders/mitigation teams.
      - escalation_response: Handling complaints or angry insureds.
      - supplement_response: Reviewing estimates, shingle counts, or price disputes.
      - coverage_analysis: Legal/Policy reasoning for what is or isn't paid.
      - denial_support: Formal reasoning for a claim rejection.
      - claim_summary: A high-level recap of the whole file.
      - xactanalysis_response: Short, technical operational notes.
      - damage_evaluation: Findings from a physical inspection (roof, kitchen, etc).
      - attorney_response: Formal, defensible response to attorneys; no liability or coverage admissions.

      CONFLICT RESOLUTION RULES:
      1. If there is an external audience (Insured/Contractor) -> Prioritize EMAIL.
      2. If it mentions a Supplement/Estimate dispute -> prioritize supplement_response.
      3. If no clear match -> return file_note.

      RETURN ONLY THE TYPE STRING. NO EXPLANATION.
    `;

    try {
      // Use your existing AI service here (ideally a fast model like GPT-4o-mini)
      const detectedType = await generateFastClassification(systemPrompt, userInput);
      return this.validateType(detectedType.trim());
    } catch (error) {
      console.error("AI Classification Failed:", error);
      return 'file_note'; 
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
    if (!input || input.length < 5) return 'file_note';

    // 1. Check Deterministic Rules
    const ruleMatch = this.runDeterministicLayer(input);
    if (ruleMatch) return ruleMatch;

    // 2. Run AI Classification with Intent Mapping
    return await this.runAILayer(input);
  }
}

export default new ClassifierService();