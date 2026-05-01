// utils/responseParser.js

const DEFAULT_NEXT_ACTION = "Continue monitoring the claim.";
const DEFAULT_SUGGESTIONS = ["Review file", "Contact insured"];

/**
 * STEP 1: Normalize (VERY IMPORTANT)
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
 * STEP 2: HARD CLEAN (used after extraction)
 */
const cleanText = (text = "") => {
  let result = text;

  // Remove markdown
  result = result.replace(/(\*\*|__|[*_~`])/g, "");

  // Remove bullets
  result = result.replace(/^\s*[-•*]+\s*/gm, "");

  // Remove leading junk like ":" "-" "is"
  result = result.replace(/^[:\-\s]+/, "");
  result = result.replace(/^(is\s+to|is\s+|to\s+)/i, "");

  // Fix multiline bullets → sentence
  if (result.includes("\n")) {
    result = result
      .split("\n")
      .map(line => line.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join(", ");
  }

  // Normalize spacing
  result = result
    .replace(/\n+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return result;
};

/**
 * STEP 3: ULTRA-ROBUST NEXT STEP DETECTION
 */
const extractNextStep = (text) => {
  const normalized = normalize(text);

  /**
   * 🔥 STRATEGY:
   * 1. Try structured section match
   * 2. Try inline sentence match (VERY IMPORTANT for your bug)
   * 3. Try loose fallback
   */

  // =========================
  // ✅ 1. STRUCTURED BLOCK
  // =========================
  const sectionRegex = new RegExp(
    `(?:^|\\n)\\s*[*\\-•]?\\s*(?:\\*\\*|__)?\\s*(next\\s*steps?|next\\s*step|recommended\\s*action)\\s*:?-?\\s*(?:\\*\\*|__)?\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*[*\\-•]?\\s*(?:\\*\\*|__|#)|$)`,
    "i"
  );

  const sectionMatch = normalized.match(sectionRegex);

  if (sectionMatch && sectionMatch[2]) {
    return cleanText(sectionMatch[2]);
  }

  // =========================
  // ✅ 2. INLINE DETECTION (CRITICAL FIX)
  // Handles:
  // "... The next step involves arranging inspection ..."
  // =========================
  const inlineRegex = /next\s*step[s]?\s*(?:is|:|-)?\s*(.*?)(?:\.|\n|$)/i;

  const inlineMatch = normalized.match(inlineRegex);

  if (inlineMatch && inlineMatch[1]) {
    return cleanText(inlineMatch[1]);
  }

  // =========================
  // ✅ 3. FALLBACK (STRICT)
  // =========================
  const fallback = normalized.match(/next\s*step[s]?\s*[:\-]?\s*(.*)/i);

  if (fallback && fallback[1]) {
    return cleanText(fallback[1]);
  }

  return "";
};

/**
 * SUGGESTIONS (kept simple + strong)
 */
const extractSuggestions = (text) => {
  const normalized = normalize(text);

  const match = normalized.match(
    /(?:suggestions|quick\s*actions|suggested\s*actions)\s*:?\s*([\s\S]*?)(?=\n\s*\n|\n[A-Z]|$)/i
  );

  if (!match) return [];

  return match[1]
    .split(/[\|\n,]/)
    .map(s => cleanText(s))
    .filter(Boolean);
};

/**
 * REMOVE SECTIONS FROM MAIN CONTENT
 */
const removeSections = (text) => {
  return normalize(text)
    .replace(
      /(?:next\s*steps?|recommended\s*action)\s*:?\s*[\s\S]*?(?=\n\s*\n|\n[A-Z]|$)/gi,
      ""
    )
    .replace(
      /(?:suggestions|quick\s*actions|suggested\s*actions)\s*:?\s*[\s\S]*?(?=\n\s*\n|\n[A-Z]|$)/gi,
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

  // ✅ FINAL FALLBACK (NON-NEGOTIABLE)
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