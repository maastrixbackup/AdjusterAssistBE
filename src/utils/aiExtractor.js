
export const extractAiComponents = (rawResponse) => {
    if (!rawResponse) return { cleanContent: "", nextStep: "" };

    let nextStep = "";

    // 1. Array of patterns to catch different AI styles
    // Matches: "Next Step: ...", "The next steps are...", "Next steps involve...", etc.
    const patterns = [
        /(?:next\s*steps?|recommended\s*action):\s*(.*)/i,
        /(?:the\s*next\s*steps?\s*(?:involve|are)\s*)(.*)/i,
        /Next\s*steps?[\s\S]*?\n([\s\S]*)/i
    ];

    for (const pattern of patterns) {
        const match = rawResponse.match(pattern);
        if (match && match[1]) {
            nextStep = match[1].trim();
            break;
        }
    }

    // 2. Clean the nextStep (Remove trailing punctuation or common AI "fluff")
    if (nextStep) {
        // Remove trailing "Sincerely..." or "Regards..." if the AI accidentally included them
        nextStep = nextStep.split(/Sincerely|Regards/i)[0].trim();
        
        // Ensure Capital First Letter
        nextStep = nextStep.charAt(0).toUpperCase() + nextStep.slice(1);
    }

    // 3. Clean the Main Content 
    // We remove the specific nextStep text and the leading phrases from the raw output
    let cleanContent = rawResponse;
    if (nextStep) {
        // Escape regex special characters in the nextStep string to avoid errors during replace
        const escapedNextStep = nextStep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const removeRegex = new RegExp(`(?:next\\s*steps?|recommended\\s*action|the\\s*next\\s*steps?\\s*(?:involve|are)).*${escapedNextStep}`, 'is');
        cleanContent = rawResponse.replace(removeRegex, '').trim();
    }

    return {
        cleanContent: cleanContent || rawResponse,
        nextStep: nextStep || "Request supporting documentation from the contractor and proceed with inspection to verify the source, scope, and extent of damages"
    };
};