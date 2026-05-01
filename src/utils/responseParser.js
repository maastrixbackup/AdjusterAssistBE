// utils/responseParser.js

const DEFAULT_NEXT_ACTION = "Continue monitoring the claim.";
const DEFAULT_SUGGESTIONS = ["Review file", "Contact insured"];

/**
 * STEP 1: Normalize text (critical for resilience)
 */
const normalize = (text = "") => {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/[ ]{2,}/g, " ")
    .trim();
};

/**
 * STEP 2: Strip markdown safely (optional for extraction)
 */
const stripMarkdown = (text = "") => {
  return text
    .replace(/(\*\*|__)/g, "") // bold
    .replace(/[*_~`]/g, "")    // inline markdown
    .replace(/^#+\s*/gm, "")   // headings
    .trim();
};

/**
 * STEP 3: Fix unbalanced markdown (very important)
 */
const fixUnbalancedMarkdown = (text = "") => {
  const count = (text.match(/\*\*/g) || []).length;
  if (count % 2 !== 0) {
    return text + "**";
  }
  return text;
};

/**
 * STEP 4: Generic section extractor (core engine)
 */
const extractSection = (text, labels = []) => {
  const normalized = normalize(text);
  const labelPattern = labels.join("|");

  const regex = new RegExp(
    `(?:^|\\n)\\s*[*\\-•]?\\s*(?:\\*\\*|__)?\\s*(?:${labelPattern})\\s*:?\\s*(?:\\*\\*|__)?\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*[*\\-•]?\\s*(?:\\*\\*|__|#)|$)`,
    "i"
  );

  const match = normalized.match(regex);
  if (!match) return "";

  return cleanText(match[1]);
};

/**
 * STEP 5: Clean extracted text
 */
const cleanText = (text = "") => {
  let result = text;

  // Fix broken bold (**)
  const boldCount = (result.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    result = result.replace(/\*\*$/, "");
  }

  // Remove leading bullets
  result = result.replace(/^\s*[*\-•]+\s*/, "");

  // Remove markdown artifacts
  result = result.replace(/(\*\*|__|[*_~`])/g, "");

  // 🔥 Remove leading colon or dash
  result = result.replace(/^[:\-\s]+/, "");

  // 🔥 Remove "is" / "is to" / "to"
  result = result.replace(/^(is\s+to|is\s+|to\s+)/i, "");

  // 🔥 Handle multi-line bullet lists properly
  if (result.includes("\n")) {
    result = result
      .split("\n")
      .map(line => line.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join(", "); // <-- cleaner than "-"
  }

  // Normalize spacing
  result = result
    .replace(/\n+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return result;
};

/**
 * NEXT STEP EXTRACTOR
 */
const extractNextStep = (text) => {
  const raw = extractSection(text, [
    "next\\s*steps?",
    "next\\s*step",
    "recommended\\s*action",
    "recommended\\s*next\\s*step"
  ]);

  if (!raw) return "";

  return cleanText(raw);
};

/**
 * SUGGESTIONS EXTRACTOR
 */
const extractSuggestions = (text) => {
  const raw = extractSection(text, [
    "suggestions",
    "quick\\s*actions",
    "suggested\\s*actions"
  ]);

  if (!raw) return [];

  return raw
    .split(/[\|\n,]/)
    .map(s => cleanText(s))
    .filter(Boolean);
};

/**
 * REMOVE EXTRACTED SECTIONS FROM MAIN CONTENT
 */
const removeSections = (text) => {
  return normalize(text)
    .replace(
      /(?:^|\n)\s*[*\-•]?\s*(?:\*\*|__)?\s*(next\s*steps?|recommended\s*action)\s*:?\s*(?:\*\*|__)?[\s\S]*?(?=\n\s*\n|\n\s*[*\-•]?\s*(?:\*\*|__|#)|$)/gi,
      ""
    )
    .replace(
      /(?:^|\n)\s*[*\-•]?\s*(?:\*\*|__)?\s*(suggestions|quick\s*actions|suggested\s*actions)\s*:?\s*(?:\*\*|__)?[\s\S]*?(?=\n\s*\n|\n\s*[*\-•]?\s*(?:\*\*|__|#)|$)/gi,
      ""
    )
    .trim();
};

/**
 * MAIN PARSER
 */
const parseAIResponse = (aiRawResponse = "") => {
  const text = normalize(aiRawResponse);

  let nextAction = extractNextStep(text);
  let dynamicSuggestions = extractSuggestions(text);
  const cleanMainContent = removeSections(text);

  /**
   * ✅ STRICT FALLBACK LAYER (ONLY if primary extraction fails)
   */
  if (!nextAction || nextAction.length < 5) {
    const fallbackMatch = text.match(/next\s*step[s]?\s*[:\-]?\s*(.*)/i);

    if (fallbackMatch && fallbackMatch[1]) {
      nextAction = cleanText(fallbackMatch[1]);
    }
  }

  /**
   * ✅ FINAL DEFAULT FALLBACK (NON-NEGOTIABLE)
   */
  if (!nextAction || nextAction.length < 5) {
    nextAction = DEFAULT_NEXT_ACTION;
  }

  if (!dynamicSuggestions || dynamicSuggestions.length === 0) {
    dynamicSuggestions = DEFAULT_SUGGESTIONS;
  }

  return {
    nextAction,
    dynamicSuggestions,
    cleanMainContent
  };
};

module.exports = {
  parseAIResponse
};

// const tests = [
//   `- **Next Step:** Await receipt of supporting documentation.`,
//   `Next Step: Schedule inspection and request photos.`,
//   `**Next Step**: Assign mitigation vendor.`,
//   `Next Step - Review estimate.`,
//   `Next Step is to schedule inspection.`,
//   `**Next Step: Schedule inspection`,
//   `•    **Next Step:**    Request documents from insured.`,
//   `**Next Step:**
//   - Schedule inspection
//   - Request photos`,
//   `next step: follow up with contractor.`,
//   `Inspection pending. Awaiting documents.`,
// ];

// tests.forEach((input, i) => {
//   const result = parseAIResponse(input);
//   console.log(`\nTest ${i + 1}`);
//   console.log("Input:", input);
//   console.log("Output:", result.nextAction);
// });