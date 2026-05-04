const DEFAULT_NEXT_ACTION = "Request supporting documentation from the contractor and proceed with inspection to verify the source, scope, and extent of damages.";
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

  // Remove markdown symbols and list bullets[cite: 1]
  result = result.replace(/(\*\*|__|[*_~`#])/g, "");
  result = result.replace(/^\s*[*\-•]+\s*/gm, "");

  // Remove leading punctuation and common "trigger" grammar[cite: 1]
  result = result.replace(/^[:\-\s]+/, "");

  // Specifically target verbs that shouldn't start the final suggestion string
  result = result.replace(/^(is\s+to|is\s+|to\s+|next\s+step\s+is\s+|involves?\s+|includes?\s+)/i, "");

  // Convert multi-line items into a single comma-separated string[cite: 1]
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
 * Handles: "**Next Step:** ...", "The next steps involve...", and "# Next Steps"[cite: 1]
 */
const extractNextStep = (text) => {
  if (!text) return "";

  // 1. Check for Structured Headers (e.g., **Next Step:**)[cite: 1]
  const headerLabels = ["next\\s*steps?", "recommended\\s*actions?", "suggested\\s*next\\s*step"];
  const headerRegex = new RegExp(
    `(?:^|\\n)\\s*[*\\-•]?\\s*(?:\\*\\*|__)?\\s*(?:${headerLabels.join("|")})\\s*:?\\s*(?:\\*\\*|__)?\\s*([\\s\\S]*?)(?=\\n\\s*(?:#|\\*\\*|__|[A-Z][a-z]+:)|\\n\\n|$)`,
    "i"
  );

  const headerMatch = text.match(headerRegex);
  if (headerMatch && headerMatch[1].trim().length > 5) {
    return cleanText(headerMatch[1]);
  }

  // 2. Check for Natural Prose (e.g., "The next steps involve...")[cite: 1]
  // Stops at a new sentence (Period + Space + Capital) or double newline
  const proseRegex = /(?:the\s+)?next\s*step[s]?\s*(?:is|are|involves?|includes?|would\s+be|will\s+be|consist\s+of)\s*[:\-]?\s*(.*?)(?:\. (?=[A-Z])|\n\n|$)/i;
  const proseMatch = stripMarkdown(text).match(proseRegex);

  if (proseMatch && proseMatch[1].trim().length > 5) {
    return cleanText(proseMatch[1]);
  }

  return "";
};

/**
 * Removes the extracted "Next Step" portion from the main body text[cite: 1]
 */
const removeNextStepFromContent = (content, nextStep) => {
  if (!nextStep || nextStep === DEFAULT_NEXT_ACTION) return content;

  // 1. Attempt to remove based on header pattern[cite: 1]
  const removalPattern = /(?:^|\n)\s*[*\-•]?\s*(?:\*\*|__)?\s*(next\s*steps?|recommended\s*action)[\s\S]*?(?=\n\s*(?:[*\\-•]|\\*\\*|__|#)|$)/gi;
  let newContent = content.replace(removalPattern, "");

  // 2. Attempt to remove based on the prose sentence[cite: 1]
  // We look for a phrase starting with "Next step" that contains the extracted action
  const cleanAction = nextStep.split(',')[0].trim();
  if (cleanAction.length > 5) {
    const prosePattern = new RegExp(`(?:the\\s+)?next\\s*step[s]?\\s*(?:is|are|involves?|includes?|would\\s+be|will\\s+be|consist\\s+of)[^.]*${cleanAction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*\\.`, "i");
    newContent = newContent.replace(prosePattern, "");
  }

  return newContent.trim();
};

/**
 * MAIN PARSER[cite: 1]
 */
const parseAIResponse = (aiRawResponse = "") => {
  const normalized = normalize(aiRawResponse);

  // Extract the next step context[cite: 1]
  let nextAction = extractNextStep(normalized) || DEFAULT_NEXT_ACTION;

  if (nextAction && nextAction.length > 0) {
    nextAction = nextAction.charAt(0).toUpperCase() + nextAction.slice(1);
  }

  // Remove the extracted part from the main content[cite: 1]
  let cleanMainContent = removeNextStepFromContent(normalized, nextAction);

  // Clean markdown for UI consistency[cite: 1]
  nextAction = nextAction
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


// const testCases = [
//   {
//     name: "Standard Markdown Header",
//     input: `The claim is under review.
    
// **Next Step:**
// Arrange an inspection to assess the kitchen floor damage.

// Please let us know if you have questions.`
//   },
//   {
//     name: "Natural Prose (Inside Paragraph)",
//     input: `We have received your report regarding the refrigerator leak. The next steps involve arranging an inspection to thoroughly assess the reported damages. We also request that any outstanding documentation be provided.`
//   },
//   {
//     name: "Bullet Point Next Steps",
//     input: `Coverage verification is underway.
    
// **Recommended Actions:**
// * Contact the tenant
// * Schedule a plumber
// * Review the policy deductible`
//   },
//   {
//     name: "Lowercase Trigger Phrase",
//     input: `Initial review is complete. next step is to request the photos of the basement ceiling from the insured immediately.`
//   },
//   {
//     name: "Multiple Sections with Markdown",
//     input: `### Claim Summary
// The water line disconnected.

// ### Next Steps
// 1. Document the damage.
// 2. Confirm the deductible.

// ### Suggestions
// Review file | Contact insured`
//   },
//   {
//     name: "Edge Case: Empty/Minimal Response",
//     input: "Next step: Call Riyan."
//   }
// ];

// // Execution loop
// console.log("--- Starting Parser Tests ---\n");

// testCases.forEach((test, index) => {
//   const result = parseAIResponse(test.input);

//   console.log(`Test #${index + 1}: ${test.name}`);
//   console.log(`[Next Action]: ${result.nextAction}`);
//   console.log(`[Main Content Length]: ${result.cleanMainContent.length} chars`);
//   console.log(`[Snippet]: ${result.cleanMainContent.substring(0, 50)}...`);
//   console.log("-----------------------------------\n");
// });