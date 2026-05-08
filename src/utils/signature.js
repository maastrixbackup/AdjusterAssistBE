// services/signature.service.js

const EXTERNAL_TYPES = [
    "EMAIL_INSURED",
    "EMAIL_CONTRACTOR",
    "SUPPLEMENT_RESPONSE",
    "ATTORNEY_RESPONSE",
];

export const getSignaturePrompt = (type, profile) => {
    const isExternal = EXTERNAL_TYPES.includes(type.toUpperCase());

    // If it's internal or the flag is disabled, explicitly forbid the signature
    if (!profile?.is_signature_enabled || !isExternal) {
        return `
        ### SIGNATURE RESTRICTION
        - DO NOT include any signature, closing, name, or contact details.
        - The response MUST end immediately after the final sentence of the message body.
        `;
    }

    const { name, company, phone, designation } = profile.signature_details || {};
    if (!name) return "";

    return `
    ### SIGNATURE BLOCK (MANDATORY)
    Append this exact signature block at the end of the response:
    ---
    Sincerely,
    
    ${name}
    ${designation || ""}
    ${company || ""}
    ${phone ? `Phone: ${phone}` : ""}
    `;
};