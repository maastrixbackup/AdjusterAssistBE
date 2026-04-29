import { generateJSON } from "../services/ai.service.js";


export const extractUnifiedContext = async (inputText, ocrData = "") => {
    const fullTextContext = `${inputText} ${ocrData}`;

    const systemPrompt = `
        You are an expert Insurance Claim Data Extractor.

        Your job is to extract structured claim facts from messy, unstructured input text (user input + OCR).

        You MUST intelligently interpret the text — not rely on labels like #Insured.

        -----------------------------------
        ### STEP 1: DETERMINE RECIPIENT ROLE (PRIORITY ORDER)
        
        1. attorney: Keywords: attorney, law firm, counsel, litigation, demand letter, suit, mediation,legal representation, regulatory demand.
        2. public_adjuster: Keywords: PA, letter of representation, representation, estimate dispute, scope dispute, supplement demand, request for reconsideration from PA, signed authorization/representation.
        3. contractor: Keywords: contractor estimate, repair estimate, pricing dispute, mitigation, contractor email, scope item dispute.
        4. internal_file: Keywords: file note, coverage analysis, status note, closing note, escalation note, claim summary, coverage analysis FNOL OR if no other role is clear.
        5. insured: Keywords: status, policyholder, payment, customer questions,document request, repair question, payment question, general claim communication when will.
        6. vendor: Keywords: mitigation vendor, dry logs, moisture readings, pack-out, emergency services, restoration vendor, plumber report, leak detection report

        -----------------------------------
        ### STEP 2: EXTRACT FACTS (IMPORTANT LOGIC)

        You must infer meaning based on context:

        - summary → short 1–2 line overview of request
        - reported_facts → what insured/claimant says happened
        - verified_facts → confirmed facts (dates, payments, coverage decisions)
        - adjuster_observations → inspection findings or adjuster conclusions
        - contractor_statements → contractor estimates, scope disputes
        - vendor_documents → mitigation/plumber reports, moisture logs
        - claim_positions → current stance (pending, denied, partial, under review)
        - missing_information → what is needed next

        IMPORTANT:
        - DO NOT leave fields empty if reasonable inference is possible
        - Extract best possible information even if implicit
        - Only use "" if absolutely no relevant info exists

        -----------------------------------
        ### STEP 3: RISK FLAGS (VERY IMPORTANT)

        Detect and return JSON ARRAY (not string):

        - If attorney mentioned:
        {"type": "attorney_involvement", "level": "high", "reason": "Attorney referenced"}

        - If public adjuster:
        {"type": "pa_involvement", "level": "medium", "reason": "Public adjuster involved"}

        - If lawsuit/demand/legal escalation:
        {"type": "legal_escalation", "level": "high", "reason": "Legal threat or demand detected"}

        If none → return []

        -----------------------------------
        ### OUTPUT FORMAT (STRICT JSON)

        {
        "recipient_role": "attorney | public_adjuster | contractor | internal_file | insured | vendor",
        "facts": {
            "summary": "string",
            "reported_facts": "string",
            "verified_facts": "string",
            "adjuster_observations": "string",
            "contractor_statements": "string",
            "vendor_documents": "string",
            "claim_positions": "string",
            "missing_information": "string",
            "risk_flags": []
        }
        }

        RETURN ONLY JSON.
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