const dynamicSuggestionDirective = `
    
    ---
    ANALYSIS TASK:
    After generating the draft above, provide 3 dynamic follow-up suggestions based on the content.
    For each suggestion, provide a short label (for a button) and a detailed prompt (for the next AI generation).
    Format exactly like this at the very end of your response:
    
    [SUGGESTIONS_START]
    Label: Request Docs | Prompt: Draft an email to the insured requesting the missing police report and photo of the VIN.
    Label: Schedule Inspection | Prompt: Create a file note documenting that a field inspection is required due to the scope of damage.
    Label: Coverage Update | Prompt: Draft a status update for the insured explaining the current coverage investigation status.
    [SUGGESTIONS_END]
    `;