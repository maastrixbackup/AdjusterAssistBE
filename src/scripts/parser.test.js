const { parseAIResponse } = require('../utils/responseParser');

const tests = [
  `- **Next Step:** Await receipt of supporting documentation.`,
  `Next Step: Schedule inspection and request photos.`,
  `**Next Step**: Assign mitigation vendor.`,
  `Next Step - Review estimate.`,
  `Next Step is to schedule inspection.`,
  `**Next Step: Schedule inspection`,
  `•    **Next Step:**    Request documents from insured.`,
  `**Next Step:**
  - Schedule inspection
  - Request photos`,
  `next step: follow up with contractor.`,
  `Inspection pending. Awaiting documents.`,
];

tests.forEach((input, i) => {
  const result = parseAIResponse(input);

  console.log(`\n==============================`);
  console.log(`Test ${i + 1}`);
  console.log(`Input: ${input}`);
  console.log(`Extracted Next Step: ${result.nextAction}`);
});