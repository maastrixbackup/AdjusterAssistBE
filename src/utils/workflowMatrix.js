

export const DecisionMatrix = {
    "email_insured": "file_note",
    "email_contractor": "file_note",
    "xactanalysis_response": "file_note",
    "escalation_response": "file_note",
    "supplement_response": "file_note",
    "denial_support": "file_note",
    "claim_summary": "file_note",
    
    // Logic-Based Routing
    "coverage_analysis": "email_insured",
    "damage_evaluation": "file_note",
    
    // Default Fallback
    "default": "file_note"
};

export const getMandatoryNextStep = (currentFormat) => {
    return DecisionMatrix[currentFormat?.toLowerCase()] || DecisionMatrix["default"];
};