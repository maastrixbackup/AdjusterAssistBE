// utils/payloadMapper.js
export const mapPayloadToInput = (payload) => {
    const { claim_context, facts, drafting_controls } = payload;
    
    return `
CLAIM CONTEXT:
- Claim #: ${claim_context?.claim_number}
- Insured: ${claim_context?.insured_name}
- Loss Type: ${claim_context?.loss_type}
- Stage: ${claim_context?.claim_stage}
- Current Issue: ${claim_context?.current_issue}

REPORTED FACTS:
- Summary: ${facts?.summary}
- Vendor/Contractor Statement: ${facts?.vendor_statement || facts?.contractor_statement}
- Document Review: ${facts?.document_review}
- Coverage Position: ${facts?.coverage_position}

NEXT STEPS (USER INTENT):
${facts?.next_steps}

SPECIAL CONTROLS:
- Style: ${drafting_controls?.format_style}
- Must Include: ${drafting_controls?.must_include?.join(', ')}
`;
};