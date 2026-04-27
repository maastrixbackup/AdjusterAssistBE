import { generateJSON } from "../services/ai.service.js";


export const extractUnifiedContext = async (inputText, ocrData = "") => {
    const fullTextContext = `${inputText} ${ocrData}`;

    const systemPrompt = `
    You are an expert Insurance Claim Data Extractor. 
    Analyze the provided USER INPUT and OCR DATA to extract a structured JSON object.

    ### RULES FOR RECIPIENT_ROLE (In Priority Order):
    1. attorney: Keywords: law firm, counsel, litigation, demand letter, suit, mediation,legal representation.
    2. public_adjuster: Keywords: PA, letter of representation, scope dispute, supplement demand.
    3. contractor: Keywords: contractor, repair estimate, pricing dispute, mitigation, dry log.
    4. internal_file: Keywords: file note, coverage analysis,status note,claim summary, coverage analysis FNOL OR if no other role is clear.
    5. insured: Keywords: status, policyholder, payment, customer questions, when will.

    ### FIELD DEFINITIONS FOR FACTS (Must be Strings):
    - summary: A concise overview of the current request.
    - reported_facts: Allegations or statements made by the insured (e.g., text after #Insured).
    - verified_facts: Confirmed data like coverage status, payment dates, or policy limits.
    - adjuster_observations: What the adjuster personally found or observed (e.g., text after "found").
    - contractor_statements: Estimates, scope disputes, or quotes from contractors (e.g., text after #Contractor).
    - vendor_documents: Details from mitigation, plumbers, or dry logs (e.g., Seroto reports).
    - claim_positions: The current stance on the claim (e.g., "Denied", "Partial Approval", "Pending").
    - missing_information: Documentation or actions still needed (e.g., text after #Next).
    - risk_flags: A JSON string containing an array of risk objects. 
    Rules: 
    - If Public Adjuster: {"type": "pa_involvement", "level": "medium", "reason": "..."}
    - If Attorney: {"type": "attorney_involvement", "level": "high", "reason": "..."}
    - If Lawsuit/Demand: {"type": "legal_escalation", "level": "high", "reason": "..."}
    Example: "[{\"type\": \"attorney_involvement\", \"level\": \"high\", \"reason\": \"Detected attorney representation.\"}]"

    ### OUTPUT FORMAT (STRICT JSON):
    {
      "recipient_role": "attorney | public_adjuster | contractor | internal_file | insured",
      "facts": {
        "summary": "string",
        "reported_facts": "string",
        "verified_facts": "string",
        "adjuster_observations": "string",
        "contractor_statements": "string",
        "vendor_documents": "string",
        "claim_positions": "string",
        "missing_information": "string",
        "risk_flags": "string"
      }
    }
    `;

    try {
        // Calling your existing AI service
        const aiResponse = await generateJSON(systemPrompt, fullTextContext);
        const sanitizedFacts = {
            summary: inputText,
            reported_facts: String(aiResponse.facts?.reported_facts || ""),
            verified_facts: String(aiResponse.facts?.verified_facts || ""),
            adjuster_observations: String(aiResponse.facts?.adjuster_observations || ""),
            contractor_statements: String(aiResponse.facts?.contractor_statements || ""),
            vendor_documents: String(aiResponse.facts?.vendor_documents || ""),
            claim_positions: String(aiResponse.facts?.claim_positions || ""),
            missing_information: String(aiResponse.facts?.missing_information || ""),
            risk_flags: typeof aiResponse.facts?.risk_flags === 'object'
                ? JSON.stringify(aiResponse.facts.risk_flags)
                : String(aiResponse.facts?.risk_flags || "[]")
        };
        return {
            recipient_role: aiResponse.recipient_role || "internal_file",
            facts: sanitizedFacts
        };
    } catch (error) {
        console.error("Extraction AI Error:", error);
        return {
            recipient_role: "internal_file",
            facts: {
                summary: inputText,
                reported_facts: "",
                verified_facts: "",
                adjuster_observations: "Extraction failed.",
                contractor_statements: "",
                vendor_documents: "",
                claim_positions: "Pending review.",
                missing_information: "Manually identify next steps.",
                risk_flags: null
            }
        };
    }
};