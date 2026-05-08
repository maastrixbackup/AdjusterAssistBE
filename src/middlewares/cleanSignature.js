
export const signatureMiddleware = (response, isEnabled) => {
    if (isEnabled) return response; // If enabled, do nothing.

    // List of common AI closing patterns to look for at the end of the string
    const closingPatterns = [
        /Sincerely,?\s*$/i,
        /Regards,?\s*$/i,
        /Best regards,?\s*$/i,
        /Thank you,?\s*$/i,
        /Thanks,?\s*$/i,
        /Kind regards,?\s*$/i,
        /Respectfully,?\s*$/i,
        /---\s*$/ // Strips trailing horizontal rules
    ];

    let cleanedResponse = response.trim();

    // Loop through patterns and strip them if they appear at the very end
    closingPatterns.forEach((pattern) => {
        // This regex looks for the pattern specifically at the end of the text
        const endPattern = new RegExp(pattern.source + ".*$", "i");
        cleanedResponse = cleanedResponse.replace(endPattern, "").trim();
    });

    // Final safety: Remove any trailing [Name] or [Company] style placeholders 
    // just in case the AI ignored the 'no placeholder' rule.
    cleanedResponse = cleanedResponse.replace(/\[.*?\]\s*$/g, "").trim();

    return cleanedResponse;
};