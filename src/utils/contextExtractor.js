
export const extractClaimContext = (inputText, ocrData = "") => {
    const fullText = (inputText + " " + ocrData).toLowerCase();

    // Helper to check for keywords in the combined context
    const contains = (keywords) => keywords.some(kw => fullText.includes(kw));

    return {
        facts: {
            summary: inputText,
            
            // 1. Inspection Findings (Detect vendor reports or "found" keywords)
            inspection_findings: contains(['found', 'observed', 'inspection', 'damage noted', 'moisture readings']) 
                ? "Extracted from adjuster notes and documentation." 
                : "Not explicitly detailed in current input.",

            // 2. Insured Statement (Logic: Check for #Insured tag or "Insured stated")
            insured_statement: inputText.match(/#Insured (.*?)($|#)/)?.[1] || 
                               (contains(['insured says', 'homeowner mentioned', 'policyholder stated']) ? "Statement captured in summary." : ""),

            // 3. Contractor Statement (Logic: Check for #Contractor or estimate terms)
            contractor_statement: inputText.match(/#Contractor (.*?)($|#)/)?.[1] || 
                                 (contains(['contractor', 'estimate', 'repair cost', 'labor rate']) ? "Based on contractor communication." : ""),

            // 4. Vendor Statement (Logic: Specifically looking for mitigation/plumbers)
            vendor_statement: contains(['mitigation', 'seroto', 'dry log', 'plumber', 'leak detection']) 
                ? "Vendor report data present." 
                : "",

            // 5. Document Review
            document_review: ocrData.length > 0 ? "Analyzed attached documentation." : "No documents attached for review.",

            // 6. Coverage Position (Identify denial or acceptance keywords)
            coverage_position: contains(['denied', 'no coverage', 'excluded', 'covered loss']) 
                ? "Adjuster indicated a coverage stance." 
                : "Pending further verification.",

            // 7. Estimate/Payment Status
            estimate_status: contains(['estimate', 'xactimate', 'replacement cost']) ? "Estimate reviewed/present." : "Missing",
            payment_status: contains(['paid', 'check', 'deductible', 'acv', 'payment sent']) ? "Payment discussed." : "Not mentioned",

            // 8. Next Steps (Semantic fallback)
            next_steps: inputText.match(/#Next (.*?)($|#)/)?.[1] || 
                        (contains(['will', 'need to', 'pending']) ? "Identified from context." : "Adjuster to determine."),

            additional_facts: ocrData.slice(0, 200) + "..." // Sample of the OCR for tracing
        }
    };
};