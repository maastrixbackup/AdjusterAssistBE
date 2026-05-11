// services/signature.service.js

const EXTERNAL_TYPES = [
    "EMAIL_INSURED",
    "EMAIL_CONTRACTOR",
    "SUPPLEMENT_RESPONSE",
    "ATTORNEY_RESPONSE",
];

export const getSignaturePrompt = (type, profile) => {
    // 1. Normalize the type to handle any case mismatches
    const normalizedType = type?.toUpperCase().replace(/\s+/g, '_');
    const isExternal = EXTERNAL_TYPES.includes(normalizedType);

    // 2. Strict check for the toggle
    const isSignatureOff = !profile?.is_signature_enabled;

    if (isSignatureOff || !isExternal) {
        return `
        ### CRITICAL INSTRUCTION: NO SIGNATURE
        - This is a partial message fragment.
        - DO NOT include "Sincerely", "Regards", "[Name]", or any closing remarks.
        - DO NOT include placeholders like [Your Name] or [Company].
        - The very last character of your response must be the punctuation of your final sentence.
        - STOP writing immediately after the body of the message.
        `;
    }

    // 3. Logic for when Signature is ON
    const { name, company, phone, designation } = profile.signature_details || {};

    if (!name) return "";

    return `
    ### SIGNATURE BLOCK
    Append the following signature exactly at the end:
    ---
    Sincerely,
    
    ${name}
    ${designation ? designation : ""}
    ${company ? company : ""}
    ${phone ? `Phone: ${phone}` : ""}
    `;
};