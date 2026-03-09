// const { OpenAI } = require("openai");

// const openai = new OpenAI({
//     apiKey: process.env.GROQ_API_KEY,
//     baseURL: "https://api.groq.com/openai/v1", 
// });

// const generateDraft = async (request, source) => {
//     const systemPrompt = `
//         You are AdjusterAssist, a professional drafting tool for US property insurance adjusters.
        
//         STRICT FORMATTING RULES:
//         1. Use clear, professional language.
//         2. Format output exactly like the examples provided below.
//         3. If the request is for an EMAIL, start with the greeting and end with "Best regards," or "Sincerely,".
//         4. If the request is for a FILE NOTE, use the header "File Note" followed by Date, Type of Contact, Summary, Investigation Status, and Next Steps.
//         5. If information is missing from the source material, use placeholders like [Insured Name] or [Date] and state "Based on available information...".

//         REFERENCE EXAMPLES:
        
//         Example 1 (Email):
//         Good afternoon [Name],
//         Thank you for your follow-up regarding [Issue].
//         [Body content based on source notes].
//         Best regards,

//         Example 2 (File Note):
//         File Note
//         Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
//         Type of Contact: [Phone Call/Email/Inspection]
//         Summary of Communication:
//         [Concise summary of what happened].
//         Investigation Status:
//         [Current status].
//         Next Steps:
//         [Specific action items].

//         Example 3 (Escalation):
//         Subject: Claim Status and Investigation Update
//         Dear [Name],
//         Thank you for your correspondence regarding [Concerns].
//         Based on available information, [Status update].
//         Sincerely,
//     `;

//     try {
//         const response = await openai.chat.completions.create({
//             model: "llama-3.3-70b-versatile", 
//             messages: [
//                 { role: "system", content: systemPrompt },
//                 { role: "user", content: `Request: ${request}\nSource Material: ${source}` }
//             ],
//             temperature: 0.3, // Lower temperature makes the output more consistent and less "creative"
//         });

//         return response.choices[0].message.content;
//     } catch (error) {
//         console.error("AI Generation Error:", error.message);
//         throw error;
//     }
// };

// module.exports = { generateDraft };
