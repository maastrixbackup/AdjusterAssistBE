
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
            allow_softening: false,
            allow_direct_request_language: false,
            preserve_user_facts_verbatim: false,
            must_include: ["under review"],
            must_avoid: ["coverage applies"],
            special_instructions: "Objective internal damage summary only."
        }
    };

    /**
     * Builds the full JSON structure
     * @param {Object} file - Database record from Supabase
     * @param {Object} input - { output_type, role, inputText, ocrData }
     */
    static build(file, { output_type, role, inputText, ocrData, userInfo }) {

        // console.log(userInfo);

        const typeKey = output_type?.toLowerCase() || "file_note";
        const config = this.#TYPE_CONFIGS[typeKey] || this.#TYPE_CONFIGS.file_note;

        return {
            output_type: typeKey,
            claim_role: role || "staff_adjuster", //// ----->  Role of Loggedin user
            sender_identity:{
                name: userInfo?.sender_name || "Adjuster Name",
                email: userInfo?.sender_email || "email",
                role: userInfo?.sender_designation || "Carrier Adjuster",
                company: userInfo?.sender_company || "AdjusterAssist™"
            },

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
                summary: inputText,
                inspection_findings: "Extract from summary if present",
                insured_statement: "Extract from summary if present" || inputText.match(/#Insured (.*?)($|#)/)?.[1] || "",
                contractor_statement: "Extract from summary if present" || text.match(/#Contractor (.*?)($|#)/)?.[1] || "",
                vendor_statement: "",
                document_review: "System generated based on adjuster notes.",
                coverage_position: "Pending further verification.",
                estimate_status: "",
                payment_status: "",
                next_steps: "Identify from summary" || text.match(/#Next (.*?)($|#)/)?.[1] || "",
                additional_facts: ""
            },
            
            communication_context: {
                audience: config.audience || "internal",
                sender_identity: "adjuster",

                recipient_name: "Extract from summary if present", // must be different from file.client_name
                recipient_role: config.recipient_role || "supervisor",

                purpose: config.purpose,
                tone_override: config.tone_override || "",
                include_salutation: config.greeting,
                include_closing: config.closing
            },

            drafting_controls: {
                length: config.length || "standard",
                format_style: config.format || "paragraph",
                allow_softening_language: config.allow_softening || false,
                allow_direct_request_language: config.allow_direct_request_language || false,
                preserve_user_facts_verbatim: config.preserve_user_facts_verbatim || false,
                must_include: config.must_include || [],
                must_avoid: config.must_avoid || [],
                special_instructions: config.special_instructions || ""
            },

            "compliance_flags": {
                "weather_related": false,
                "mitigation_involved": false,
                "contents_involved": false,
                "mold_or_odor_flag": false,
                "emergency_repairs_flag": false,
                "prior_damage_flag": false,
                "coverage_sensitive": false,
                "doi_sensitive": false,
                "litigation_sensitive": false,
                "high_escalation": false
            },

            "attachments_context": {
                "photos_received": !!ocrData,
                "estimate_received": false,
                "invoice_received": false,
                "proof_of_loss_received": false,
                "mitigation_docs_received": false,
                "expert_report_received": false
            }
        };
    }

    static async buildVariantPayload({ fileId, originalContent, instructions, variantLabel }) {
        // 1. Define the System Persona for Variants
        const systemInstruction = `
            You are a specialized Insurance Claims Assistant. 
            Your task is to TRANSFORM the provided content into a ${variantLabel.toUpperCase()} format.
            
            STRICT GUARDRAILS:
            - Use only the facts provided in the original content.
            - Adopt the standard structural conventions of a ${variantLabel}.
            - Maintain professional, objective, and adjuster-standard language.
            - If the original content contains specific claim numbers or dates, they MUST be preserved.
        `;

        // 2. Format the Prompt
        const prompt = `
            ${instructions}

            ORIGINAL CONTENT TO TRANSFORM:
            """
            ${originalContent}
            """

            Provide the ${variantLabel} below:
        `;

        // 3. Return the standard payload structure for your AI Service
        return {
            fileId,
            systemInstruction,
            messages: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                temperature: 0.3, // Lower temperature for structural accuracy
                maxOutputTokens: 2048,
            }
        };
    }

    static async buildRefinementPayload({ originalContent, rule }) {
        // 1. Define the System Instruction for Refinements
        const systemInstruction = `
            You are an expert Insurance Content Editor. 
            Your goal is to REWRITE the provided content based on a specific user rule.
            
            STRICT GUARDRAILS:
            - DO NOT change the facts, claim numbers, dates, or names.
            - DO NOT add new information that is not in the original text.
            - ONLY change the tone, length, or compliance language as requested.
            - Maintain a professional insurance adjuster standard.
        `;

        // 2. Format the Prompt to isolate the content and the rule
        const prompt = `
            REFINEMENT RULE: ${rule}

            CONTENT TO REFINE:
            """
            ${originalContent}
            """

            Provide the refined version below:
        `;

        // 3. Return the payload
        return {
            systemInstruction,
            messages: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                temperature: 0.1, // Set very low to prevent "creative" hallucinations
                maxOutputTokens: 2048,
                topP: 0.1
            }
        };
    }
}

module.exports = PayloadBuilder;