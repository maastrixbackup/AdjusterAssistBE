
export const classifyAudience = (inputText, attachments = []) => {
    const text = inputText.toLowerCase();
    
    // 1. High-Priority: Attorney (Legal risk)
    if (/\b(attorney|law firm|counsel|litigation|suit|mediation|legal representation|demand letter)\b/i.test(text)) {
        return 'attorney';
    }

    // 2. High-Priority: Public Adjuster (Firmness required)
    if (/\b(public adjuster|pa|letter of representation|representation|supplement demand|scope dispute)\b/i.test(text)) {
        return 'public_adjuster';
    }

    // 3. Contractor / Vendor
    if (/\b(contractor|estimate|repair|pricing dispute|dry log|moisture|mitigation)\b/i.test(text)) {
        return 'contractor';
    }

    // 4. Internal / File Note (Explicit user request)
    if (/\b(file note|status note|claim summary|coverage analysis|fnol)\b/i.test(text)) {
        return 'internal_file';
    }

    // 5. Insured (Customer facing)
    if (/\b(status|payment|when will|insured|policyholder)\b/i.test(text)) {
        return 'insured';
    }

    // Fallback Rule
    return 'internal_file'; 
};