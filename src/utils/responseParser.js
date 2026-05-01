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

  // Build dynamic regex for labels
  const labelPattern = labels.join("|");

  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*|__|#+\\s*)?\\s*(?:${labelPattern})\\s*(?:\\*\\*|__)?\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*(?:\\*\\*|__|#)|$)`,
    "i"
  );

  const match = normalized.match(regex);
  if (!match) return "";

  let content = match[1].trim();

  content = fixUnbalancedMarkdown(content);

  return content;
};

/**
 * STEP 5: Clean extracted text
 */
const cleanText = (text = "") => {
  let result = text;

  // 1. Fix unbalanced bold (**)
  const boldCount = (result.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    result = result.replace(/\*\*$/, ""); // remove trailing broken **
  }

  // 2. Remove leading bullet markers (*, -, •)
  result = result.replace(/^\s*[*\-•]+\s*/, "");

  // 3. Remove stray single * at start/end
  result = result.replace(/^\*\s*/, "").replace(/\s*\*$/, "");

  // 4. Remove any remaining stray markdown artifacts at edges
  result = result.replace(/^\*+/, "").replace(/\*+$/, "");

  // 5. Normalize spacing
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
      /(?:^|\n)\s*(?:\*\*|__|#+\s*)?\s*(next\s*steps?|recommended\s*action)[\s\S]*?(?=\n\s*\n|\n\s*(?:\*\*|__|#)|$)/gi,
      ""
    )
    .replace(
      /(?:^|\n)\s*(?:\*\*|__|#+\s*)?\s*(suggestions|quick\s*actions|suggested\s*actions)[\s\S]*?(?=\n\s*\n|\n\s*(?:\*\*|__|#)|$)/gi,
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

  // ✅ FALLBACKS
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