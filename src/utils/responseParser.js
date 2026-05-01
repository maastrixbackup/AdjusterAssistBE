const DEFAULT_NEXT_ACTION = "Continue monitoring the claim.";
const DEFAULT_SUGGESTIONS = ["Review file", "Contact insured"];

/**
 * Normalizes whitespace and characters
 */
const normalize = (text = "") => {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
};

/**
 * Strips markdown symbols for clean string comparisons
 */
const stripMarkdown = (text = "") => {
  return text
    .replace(/(\*\*|__)/g, "")
    .replace(/[*_~`#]/g, "")
    .trim();
};

/**
 * Cleans the extracted fragment by removing leading verbs and artifacts
 */
const cleanText = (text = "") => {
  if (!text) return "";
  let result = text;

  // Remove markdown symbols and list bullets
  result = result.replace(/(\*\*|__|[*_~`#])/g, "");
  result = result.replace(/^\s*[*\-•]+\s*/gm, "");

  // Remove leading punctuation and common "trigger" grammar
  result = result.replace(/^[:\-\s]+/, "");
  result = result.replace(/^(is\s+to|is\s+|to\s+|next\s+step\s+is\s+|involves?\s+)/i, "");

  // Convert multi-line items into a single comma-separated string
  if (result.includes("\n")) {
    result = result
      .split("\n")
      .map(line => line.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return result.replace(/\s+/g, " ").trim();
};

/**
 * PRIMARY EXTRACTOR
 * Handles: "**Next Step:** ...", "Next steps involve...", and "# Next Steps"
 */
const extractNextStep = (text) => {
  if (!text) return "";

  // 1. Check for Structured Headers (e.g., **Next Step:** or # Next Step)
  // This looks for the label and captures until a double newline or another header
  const headerLabels = ["next\\s*steps?", "recommended\\s*action", "suggested\\s*next\\s*step"];
  const headerRegex = new RegExp(
    `(?:^|\\n)\\s*[*\\-•]?\\s*(?:\\*\\*|__)?\\s*(?:${headerLabels.join("|")})\\s*:?\\s*(?:\\*\\*|__)?\\s*([\\s\\S]*?)(?=\\n\\s*(?:[*\\-•]|\\*\\*|__|#)|\\n\\n|$)`,
    "i"
  );

  const headerMatch = text.match(headerRegex);
  if (headerMatch && headerMatch[1].trim().length > 5) {
    return cleanText(headerMatch[1]);
  }

  // 2. Check for Natural Prose (e.g., "The next steps involve...")
  const proseRegex = /(?:the\s+)?next\s*step[s]?\s*(?:is|are|involves?|includes?|would\s+be|will\s+be|consist\s+of)\s*[:\-]?\s*(.*?)(?:\. (?=[A-Z])|\n\n|$)/i;
  const proseMatch = stripMarkdown(text).match(proseRegex);
  
  if (proseMatch && proseMatch[1].trim().length > 5) {
    return cleanText(proseMatch[1]);
  }

  return "";
};

/**
 * Removes the extracted "Next Step" portion from the main body text
 */
const removeNextStepFromContent = (content, nextStep) => {
  if (!nextStep || nextStep === DEFAULT_NEXT_ACTION) return content;

  // Create a version of content without markdown to find the index of the next step
  const strippedContent = stripMarkdown(content);
  const cleanAction = nextStep.split(',')[0]; // Use first part of action for matching

  // If the action text exists in the content, we try to remove the block it belongs to
  if (strippedContent.includes(cleanAction)) {
    // This regex identifies the "Next step" block (header + content) for removal
    const removalPattern = /(?:^|\n)\s*[*\-•]?\s*(?:\*\*|__)?\s*(next\s*steps?|recommended\s*action)[\s\S]*?(?=\n\s*(?:[*\\-•]|\\*\\*|__|#)|$)/gi;
    const removedHeaderContent = content.replace(removalPattern, "");
    
    // If the prose was part of a normal paragraph, we do a direct string replace
    return removedHeaderContent.replace(nextStep, "").trim();
  }

  return content;
};

/**
 * MAIN PARSER
 */
const parseAIResponse = (aiRawResponse = "") => {
  const normalized = normalize(aiRawResponse);

  // Extract
  const nextAction = extractNextStep(normalized) || DEFAULT_NEXT_ACTION;
  
  // Clean main body
  let cleanMainContent = removeNextStepFromContent(normalized, nextAction);
  
  // Remove all formatting for UI consistency
  cleanMainContent = cleanMainContent
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return {
    nextAction,
    dynamicSuggestions: DEFAULT_SUGGESTIONS,
    cleanMainContent
  };
};

module.exports = {
  parseAIResponse
};