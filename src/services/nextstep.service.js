const aiService = require("./ai.service.js");

const {
  validateNextStep,
} = require(
  "../validators/nextStepvalidator.js"
);

const generateValidatedNextStep =
  async ({
    audienceType,
    userInput,
    payload,
    draftContent,
  }) => {

    // FIRST ATTEMPT
    let nextStep =
      await aiService.generateNextStep({
        audienceType,
        userInput,
        payload,
        draftContent,
      });

    const isValid =
      validateNextStep(
        nextStep,
        audienceType
      );

    // RETRY IF INVALID
    if (!isValid) {

      console.warn(
        "[NEXT STEP] Invalid output detected. Regenerating..."
      );

      nextStep =
        await aiService.generateNextStep({
          audienceType,
          userInput,
          payload,
          draftContent,
          retryMode: true,
        });

      // OPTIONAL SECOND VALIDATION
      const retryValid =
        validateNextStep(
          nextStep,
          audienceType
        );

      if (!retryValid) {

        console.warn(
          "[NEXT STEP] Retry validation failed. Using fallback."
        );

        return buildFallbackNextStep(
          audienceType
        );
      }
    }

    return nextStep;
  };

// SAFE FALLBACKS
const buildFallbackNextStep =
  (audienceType) => {

    const fallbacks = {

      attorney:
        "Continue review of counsel-submitted documentation and evaluate any additional legal support materials as needed.",

      public_adjuster:
        "Continue review of the submitted supplement documentation and evaluate any additional estimate support as needed.",

      contractor:
        "Continue review of contractor-submitted documentation and evaluate the repair scope and supporting records.",

      insured:
        "Continue claim review and request any additional information needed to support the evaluation.",

      internal_file:
        "Continue review of the available documentation and determine whether additional supporting information is required from the submitting party.",
    };

    return (
      fallbacks[audienceType] ||
      "Continue review of available claim documentation and determine whether additional information is required."
    );
  };

module.exports = {
  generateValidatedNextStep,
};