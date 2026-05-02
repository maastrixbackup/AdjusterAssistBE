class PayloadBuilder {
    static #TYPE_CONFIGS = {
        "file_note": {
            // Communication Context
            audience: "internal",
            recipient_role: "",
            tone_override: "",
            purpose: "document vender call",
            greeting: false,
            closing: false,

            // Drafting Control
            length: "standard",
            format: "paragraph",
            markdown_level: "structured",
            allow_softening: true,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: false,
            must_include: ["Next step"],
            must_avoid: [],
            special_instructions: "Keep Consise and file-ready",
        },
        "email_insured": {
            audience: "external",
            recipient_role: "insured",
            tone_override: "",
            purpose: "provide status update",
            greeting: true,
            closing: true,

            length: "standard",
            format: "paragraph",

            markdown_level: "none",
            allow_softening: true,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: false,
            must_include: [],
            must_avoid: ["coverage confirmed", "payment will be issued"],
            special_instructions: "Keep clear and professional.",
        },
        "email_contractor": {
            audience: "external",
            recipient_role: "contractor",
            tone_override: "firm",
            purpose: "request suppliment support",
            greeting: true,
            closing: true,

            length: "short",
            format: "paragraph",

            markdown_level: "none",
            allow_softening: false,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: false,
            must_include: ["supporting documentation"],
            must_avoid: ["approved", "payment will be made"],
            special_instructions: "Short, direct, professional.",
        },
        "escalation_response": {
            audience: "internal",
            recipient_role: "supervisor",
            tone_override: "",
            purpose: "respond to escalation",
            greeting: false,
            closing: false,

            length: "standard",
            format: "paragraph",
            markdown_level: "structured",
            allow_softening: true,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: false,
            must_include: ["actions taken", "next step"],
            must_avoid: [],
            special_instructions: "Internal escalation summary.",
        },
        "xactanalysis_response": {
            audience: "external_or_platform",
            recipient_role: "vendor",
            tone_override: "",
            purpose: "Xact Analysis note",
            greeting: false,
            closing: false,

            length: "short",
            format: "paragraph",
            markdown_level: "label_only",
            allow_softening: true,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: false,
            must_include: ["under review"],
            must_avoid: ["approved"],
            special_instructions: "Very short platform note",
        },
        "supplement_response": {
            audience: "external",
            recipient_role: "contractor",
            tone_override: "",
            purpose: "request suppliment support",
            greeting: true,
            closing: true,

            length: "short",
            format: "paragraph",
            markdown_level: "structured",
            allow_softening: true,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: false,
            must_include: ["under review"],
            must_avoid: ["approved"],
            special_instructions: "Keep concise",
        },
        "coverage_analysis": {
            audience: "internal",
            recipient_role: "",
            tone_override: "",
            purpose: "internal coverage reasoning",
            greeting: false,
            closing: false,

            length: "standard",
            format: "paragraph",
            markdown_level: "structured",
            allow_softening: true,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: false,
            must_include: ["based on current facts"],
            must_avoid: ["quoted policy language"],
            special_instructions: "Remain conservative and objective.",
        },
        "denial_support": {
            audience: "internal",
            recipient_role: "",
            tone_override: "",
            purpose: "denial support drafting",
            greeting: false,
            closing: false,

            length: "standard",
            format: "paragraph",

            markdown_level: "none",
            allow_softening: true,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: false,
            must_include: ["wear, tear, and deterioration"],
            must_avoid: ["bad faith", "fraud"],
            special_instructions: "Formal and neutral",
        },
        "claim_summary": {
            audience: "internal",
            recipient_role: "",
            tone_override: "",
            purpose: "quick status summary",
            greeting: false,
            closing: false,

            length: "short",
            format: "paragraph",
            markdown_level: "structured",
            allow_softening: true,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: false,
            must_include: ["next step"],
            must_avoid: [],
            special_instructions: "Quick handoff summary",
        },
        "damage_evaluation": {
            audience: "internal",
            recipient_role: "vendor",
            tone_override: "",
            purpose: "damage summary",
            greeting: false,
            closing: false,

            length: "standard",
            format: "paragraph",
            markdown_level: "structured",
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: false,
            must_include: ["under review"],
            must_avoid: ["coverage applies"],
            special_instructions: "Objective internal damage summary only."
        },

        "attorney_response": {
            audience: "external",
            recipient_role: "attorney",
            tone_override: "attorney_facing",
            purpose: "attorney response",
            greeting: true,
            closing: true,

            length: "medium",
            format: "structured paragraph",
            markdown_level: "none",
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: true,
            must_include: ["position statement"],
            must_avoid: ["admission_of_liability", "speculation"],
            special_instructions: "Precise, controlled, legally safe, no extra wording"
        },
        "fnol": {
            audience: "internal",
            recipient_role: "internal_file",
            tone_override: "",
            purpose: "fnol",
            greeting: false,
            closing: false,

            length: "short",
            format: "structured_template",
            markdown_level: "label_only",
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: true,
            must_include: ["date_of_loss", "cause_of_loss", "reported_by", "initial_observations"],
            must_avoid: [],
            special_instructions: "Strict FNOL template format, no fluff"
        },
        "inspection_summary": {
            audience: "internal",
            recipient_role: "internal_file",
            tone_override: "",
            purpose: "inspection_summary",
            greeting: false,
            closing: false,

            length: "medium",
            format: "structured_template",
            markdown_level: "structured",
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: true,
            must_include: ["areas_inspected", "damages_observed", "cause_assessment", "photos_reference"],
            must_avoid: [],
            special_instructions: "Clear separation of observed vs reported vs confirmed"
        },
        "first_contact_note": {
            audience: "internal",
            recipient_role: "internal_file",
            tone_override: "neutral",
            purpose: "first_contact_note",
            greeting: false,
            closing: false,

            length: "medium",
            format: "structured_paragraph",
            markdown_level: "label_only",
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: true,
            must_include: ["contact_made_with_insured", "claim_or_property_verification_if_discussed", "deductible_or_payment_information_if_discussed", "reported_cause_of_loss", "reported_damages", "mitigation_status", "inspection_or_documentation_next_steps", "coverage_position_pending_review"],
            must_avoid: ["unsupported_coverage_determination", "invented_policy_details", "customer_service_email_language", "salutation", "closing_signature"],
            special_instructions: "Generate an internal first contact claim note. Document what was verified, what the insured reported, current mitigation/inspection status, and next steps. Use reported/verified/pending language. Do not invent missing details"
        },
        "closing_note": {
            audience: "internal",
            recipient_role: "internal_file",
            tone_override: "neutral",
            purpose: "inspection_summary",
            greeting: false,
            closing: false,

            length: "short",
            format: "structured_paragraph",
            markdown_level: "label_only",
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: true,
            must_include: ["claim_status", "coverage_position", "payment_status_if_known", "deductible_status_if_relevant", "outstanding_items_if_any", "reason_for_closure"],
            must_avoid: ["unsupported_coverage_conclusions", "new_facts_not_in_record", "customer_service_language", "salutation", "closing_signature", "legal_advice"],
            special_instructions: "Generate a concise internal claim closing note. Use only known facts from the claim thread, user input, documents, or OCR context. Clearly state why the claim is being closed or what status supports closure. If any information is missing, state only what is pending or unknown. Do not invent missing details. Keep wording neutral, factual, and claim-file ready"
        },
        "claim_guidance": {
            audience: "internal",
            recipient_role: "adjuster",
            tone_override: "professional_adjuster_guidance",
            purpose: "claim_handling_guidance",
            greeting: false,
            closing: false,

            length: "medium",
            format: "structured_guidance",
            markdown_level: "structured",
            allow_softening: false,
            allow_direct_request_language: true,
            preserve_user_facts_verbatim: true,
            must_include: [
                "Guidance",
                "Claim Handling Rationale",
                "Claim-Safe Limitation",
                "Recommended Next Step"
            ],
            must_avoid: [
                "email format",
                "file note format",
                "greetings",
                "sign-offs",
                "coverage confirmation",
                "payment confirmation"
            ],
            special_instructions: `This is a guidance response. Do NOT convert into any document format. Answer the question directly using claim facts.`

        },
    };

    static build(file, { output_type, inputText, claim_facts, ocrData, userInfo, files, audience }) {
        const typeKey = output_type?.toLowerCase() || "file_note";
        const config = this.#TYPE_CONFIGS[typeKey] || this.#TYPE_CONFIGS.file_note;
        const fullTextContext = (inputText + " " + ocrData).toLowerCase();
        const claimFacts = claim_facts || {};
        return {
            output_type: typeKey,
            claim_role: userInfo?.role || "staff_adjuster",
            sender_identity: {
                name: userInfo?.sender_name || "Adjuster",
                email: userInfo?.sender_email,
                role: userInfo?.sender_designation || "Carrier Adjuster",
                company: userInfo?.sender_company || "AdjusterAssist™"
            },

            user_input: inputText,
            jurisdiction: file.jurisdiction || "CT", ///// ---->>>>>
            line_of_business: file.line_of_business || "homeowners", //////------->>>> 

            claim_context: {
                claim_number: file.claim_number,
                date_of_loss: file.date_of_loss || "2026-01-28",
                reported_date: file.reported_date || "2026-01-29",
                loss_type: file.loss_type || "water",
                policy_form: file.policy_form || "",
                insured_name: file.client_name,
                property_address: file.address || "",
                claim_stage: file.claim_stage || "general_review",
                current_issue: inputText.substring(0, 75).replace(/\n/g, " ") + "..."  ///------>>
            },

            facts: {
                summary: claimFacts?.summary || inputText,
                reported_facts: claimFacts?.reported_facts || "Attorney is seeking information regarding the status of the claim.",
                verified_facts: claimFacts?.verified_facts || "Pending verification of coverage and payment.",
                adjuster_observations: claimFacts?.adjuster_observations || "",
                contractor_statements: claimFacts?.contractor_statements || "",
                vendor_documents: claimFacts?.vendor_documents || "",
                claim_positions: claimFacts?.claim_positions || "Claim position remains pending",
                missing_information: claimFacts?.missing_information || "Supporting documentation is needed before a complete claim response can be issued.",
                risk_flags: claimFacts?.risk_flags || [
                    audience.includes('attorney') ? '{"type": "attorney_involvement", "level": "high", "reason": "Attorney representation or legal communication detected."}' : null,
                    audience.includes('public_adjuster') ? '{"type": "pa_involvement", "level": "medium", "reason": "Public adjuster communication or representation detected"}' : null,
                    String(claimFacts?.claim_positions || "").toLowerCase().includes('denied') ? '{"type": "dispute", "level": "medium", "reason": "Coverage denial mentioned."}' : null
                ]
                    .filter(item => item && String(item).trim() !== "" && String(item) !== "[]")
                    .join("; ") || ""
            },

            communication_context: {
                audience: config.audience || "internal",
                sender_identity: "Carrier adjuster",

                recipient_name: file.client_name || "Extract from summary if present",
                recipient_role: audience || "internal_file",

                purpose: config.purpose,
                tone_override: config.tone_override || "",
                include_salutation: config.greeting,
                include_closing: config.closing
            },

            drafting_controls: {
                length: config.length || "standard",
                format_style: config.format || "paragraph",
                markdown_level: config.markdown_level || "none",
                allow_softening_language: config.allow_softening || false,
                allow_direct_request_language: config.allow_direct_request_language || false,
                preserve_user_facts_verbatim: config.preserve_user_facts_verbatim || false,
                must_include: config.must_include || [],
                must_avoid: config.must_avoid || [],
                special_instructions: config.special_instructions || ""
            },

            "compliance_flags": {
                "weather_related": /storm|hail|wind|hurricane|tornado|lightning|flood/i.test(fullTextContext) || false,
                "mitigation_involved": /dry-out|mitigation|dehumidifier|extraction|servpro|water restoration/i.test(fullTextContext) || false,
                "contents_involved": /personal property|contents|furniture|clothing|belongings|inventory/i.test(fullTextContext) || false,
                "mold_or_odor_flag": /mold|mildew|fungus|odor|smell|musty/i.test(fullTextContext),
                "emergency_repairs_flag": /immediate|tarp|board-up| boarded |emergency|plumber repair|temp repair/i.test(fullTextContext) || false,
                "prior_damage_flag": /prior|previous|pre-existing|old damage|past claim/i.test(fullTextContext) || false,
                "coverage_sensitive": /determination|denial|partial|coverage issue|policy limit|exclusion/i.test(fullTextContext) || false,
                "doi_sensitive": /date of loss|occurrence date|policy effective|lapse/i.test(fullTextContext) || false,
                "litigation_sensitive": /attorney|lawyer|legal|lawsuit|summons|public adjuster|p\.a\.|litigation/i.test(fullTextContext) || false,
                "high_escalation": /complaint|supervisor|manager|regulatory|bad faith|doi complaint|dissatisfied/i.test(fullTextContext) || false
            },

            "attachments_context": {
                "ocrData": ocrData,
                "photos_received": (!!files && Array.isArray(files) && files.some(f => f.mimetype?.startsWith('image/'))) || (typeof files === 'string' && files.includes('supabase.co') && files.match(/\.(png|jpg|jpeg|webp|gif)/i)) || false,
                "estimate_received": /estimate|xactimate|scope of work|line items/i.test(fullTextContext) || false,
                "invoice_received": /invoice|bill|amount due|payment terms/i.test(fullTextContext) || false,
                "proof_of_loss_received": /proof of loss|notarized|sworn statement/i.test(fullTextContext) || false,
                "mitigation_docs_received": /moisture log|psychrometric|dry log|drying certificate/i.test(fullTextContext) || false,
                "expert_report_received": /engineer report|plumber report|expert opinion|cause and origin/i.test(fullTextContext) || false
            }
        };
    }



    static async buildRefinementPayload({ originalContent, rule }) {
        // 1. Enhanced System Instruction
        const systemInstruction = `
        You are a Senior Insurance Claims Specialist and Editor.
                TASK: Transform the "ORIGINAL CONTENT" based ONLY on the "REFINEMENT RULE".
        
        STRICT OPERATIONAL DIRECTIVES:
                - CONTEXT LOCK: Do not invent new damages, dates, or claim facts. 
        - DATA INTEGRITY: Preserve all names, claim numbers, and financial figures exactly as they appear.
        - NO INTRODUCTIONS: Do not say "Here is the refined version" or "As an attorney-facing document...". 
        - OUTPUT ONLY: Provide the edited text and nothing else.
        
        REFINEMENT STYLE GUIDE:
                - shorten: Remove wordiness.Focus on the 'Bottom Line'.
        - formal: Use passive voice where appropriate and industry terminology(e.g., "Correspondence" instead of "Letter").
        - attorney_facing: Focus on policy citations, factual evidence, and objective observations to withstand legal scrutiny.
        - firm: Use decisive language.Replace "we might consider" with "the position remains".
        - doi_safe: Ensure compliance with Department of Insurance standards; use neutral, transparent, and non- prejudicial language.
    `;

        // 2. Structured Prompt
        const prompt = `
        [REFINEMENT RULE]
        ${rule}

[ORIGINAL CONTENT TO BE TRANSFORMED]
"""
        ${originalContent}
"""

[TRANSFORMED TEXT]
`;

        // 3. Return the payload with history if available
        return {
            systemInstruction,
            messages: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                temperature: 0.0, // Reduced to 0.0 for maximum consistency/predictability
                maxOutputTokens: 2048,
                topP: 0.1,
                presencePenalty: 0.0,
                frequencyPenalty: 0.0
            }
        };
    }
}


module.exports = PayloadBuilder;