/**
 * PayloadBuilder Orchestrator
 * Responsibility: Transform raw user input and DB metadata into the 
 * complex JSON structure required by the Carrier client.
 */

class PayloadBuilder {
    // 1. Unified Configuration Mapping based on Client Requirements
    static #TYPE_CONFIGS = {
        "file_note": { 
            audience: "internal", greeting: false, closing: false, 
            length: "standard", format: "paragraph", allow_softening: false,
            must_include: ["actions taken", "next step"],
        },
        "email_insured": { 
            audience: "external", greeting: true, closing: true, 
            length: "standard", format: "paragraph", allow_softening: true,
            must_include: [],must_avoid:  ["coverage confirmed", "payment will be issued"],
            special_instructions: "Keep clear and professional."
        },
        "email_contractor": { 
            audience: "external", greeting: true, closing: true, 
            length: "short", format: "paragraph", allow_softening: false,
            must_include:  ["supporting documentation"], must_avoid: ["approved", "payment will be made"],
            special_instructions: "Short, direct, professional." 
        },
        "escalation_response": { 
            audience: "internal", greeting: false, closing: false, 
            length: "standard", format: "paragraph", allow_softening: false,
            must_include: ["actions taken", "next step"], must_avoid:[],
            special_instructions: "Internal escalation summary.", 
        },
        "supplement_response": { 
            audience: "external", greeting: true, closing: true, 
            length: "short", format: "paragraph", allow_softening: false 
        },
        "coverage_analysis": { 
            audience: "internal", greeting: false, closing: false, 
            length: "standard", format: "paragraph", allow_softening: false 
        },
        "denial_support": { 
            audience: "internal", greeting: false, closing: false, 
            length: "standard", format: "paragraph", allow_softening: false 
        },
        "claim_summary": { 
            audience: "internal", greeting: false, closing: false, 
            length: "short", format: "paragraph", allow_softening: false 
        },
        "xactanalysis_response": { 
            audience: "external_or_platform", greeting: false, closing: false, 
            length: "short", format: "paragraph", allow_softening: false 
        },
        "damage_evaluation": { 
            audience: "internal", greeting: false, closing: false, 
            length: "standard", format: "paragraph", allow_softening: false 
        }
    };

    /**
     * Builds the full JSON structure
     * @param {Object} file - Database record from Supabase
     * @param {Object} input - { output_type, role, inputText, task_type }
     */
    static build(file, { output_type, role, inputText, task_type }) {
        const typeKey = output_type?.toLowerCase() || "file_note";
        const config = this.#TYPE_CONFIGS[typeKey] || this.#TYPE_CONFIGS.file_note;

        return {
            output_type: typeKey,
            claim_role: role || "staff_adjuster",
            jurisdiction: file.jurisdiction || "CT",
            line_of_business: file.line_of_business || "homeowners",
            
            claim_context: {
                claim_number: file.claim_number,
                date_of_loss: file.date_of_loss || "2026-01-28",
                reported_date: file.reported_date || "2026-01-29",
                loss_type: file.loss_type || "water",
                policy_form: file.policy_form || "",
                insured_name: file.client_name,
                property_address: file.address || "",
                claim_stage: task_type || file.claim_stage || "general_review",
                current_issue: inputText.substring(0, 75).replace(/\n/g, " ") + "..."
            },

            facts: {
                summary: inputText,
                inspection_findings: "",
                insured_statement: "",
                contractor_statement: "",
                vendor_statement: "",
                document_review: "System generated based on adjuster notes.",
                coverage_position: "Pending further verification.",
                estimate_status: "",
                payment_status: "",
                next_steps: "See generated draft for proposed actions.",
                additional_facts: ""
            },

            communication_context: {
                audience: config.audience,
                sender_identity: role || "adjuster",
                recipient_name: "manager",
                recipient_role: config.audience === "external" ? "insured" : "internal_team",
                purpose: `Generate ${typeKey.replace('_', ' ')}`,
                tone_override: "",
                include_salutation: config.greeting,
                include_closing: config.closing
            },

            drafting_controls: {
                length: config.length,
                format_style: config.format,
                allow_softening_language: config.allow_softening,
                allow_direct_request_language: true,
                preserve_user_facts_verbatim: false,
                must_include: config.must_include,
                must_avoid: config.must_avoid,
                special_instructions: config.special_instructions
            }
        };
    }
}

module.exports = PayloadBuilder;