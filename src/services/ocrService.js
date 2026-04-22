const fs = require('fs');
const OpenAI = require('openai');
const { pdf } = require('pdf-to-img');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OCRService = {
    async extractInsights(files) {
        if (!files || files.length === 0) return "No attachments provided.";

        const insights = await Promise.all(
            files.map(async (file) => {
                try {
                    if (file.mimetype.startsWith('image/')) {
                        return await this.processImage(file);
                    } else if (file.mimetype === 'application/pdf') {
                        return await this.processMultiPagePDF(file);
                    }
                    else if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
                        return await this.processTextFile(file);
                    }
                    return "";
                } catch (err) {
                    console.error(`[OCR Error] ${file.originalname}:`, err.message);
                    return `[Error processing ${file.originalname}]`;
                }
            })
        );

        return insights.filter(i => i !== "").join("\n\n---\n\n");
    },

    /**
     * PROCESS IMAGES: Refined to extract text and visual context
     */
    async processImage(file) {
        const base64Image = fs.readFileSync(file.path, { encoding: 'base64' });
        return await this.callVisualAI(base64Image, file.mimetype, file.originalname, "photo");
    },

    async processTextFile(file) {
        const content = fs.readFileSync(file.path, { encoding: 'utf-8' });
        const maxLength = 15000;

        const safeContent = content.length > maxLength
            ? content.substring(0, maxLength) + "\n...[Text truncated for length]..."
            : content;

        return `[Source: ${file.originalname}]\n${safeContent}`;
    },

    /**
     * MULTI-PAGE PDF: Iterates through all pages
     */
    async processMultiPagePDF(file) {
        try {
            console.log(`[OCR] Analyzing Multi-page PDF: ${file.originalname}`);
            const document = await pdf(file.path, { scale: 2.0 });
            let fullPDFContext = [];
            let pageCounter = 1;

            // Loop through every page in the PDF
            for await (const pageBuffer of document) {
                console.log(`[OCR] Processing Page ${pageCounter} of ${file.originalname}`);
                const base64 = pageBuffer.toString('base64');

                const pageAnalysis = await this.callVisualAI(
                    base64,
                    'image/png',
                    `${file.originalname} (Page ${pageCounter})`,
                    "document"
                );

                fullPDFContext.push(pageAnalysis);
                pageCounter++;

                // Safety: Stop after 10 pages to avoid massive token costs/delays
                if (pageCounter > 10) {
                    fullPDFContext.push("...[Document truncated after 10 pages]...");
                    break;
                }
            }

            return fullPDFContext.join("\n\n");
        } catch (err) {
            throw new Error(`Multi-page rendering failed: ${err.message}`);
        }
    },

    /**
     * REFINED PROMPTING: Logic to extract 'Drafting Context'
     */
    async callVisualAI(base64, mimetype, filename, type) {
        const prompt = type === "document"
            ? `Transcribe and analyze this document for an insurance claim file. 
               1. Identify the document type (Invoice, Policy, Estimate, Letter).
               2. Extract every DATE, DOLLAR AMOUNT, and NAME found.
               3. Summarize the technical content for a claim draft. 
               Be extremely detailed with numbers.`
            : `Analyze this inspection photo for an insurance claim.
               1. Describe exactly what is visible (e.g., 'Water stains on white drywall').
               2. Identify the severity and specific materials.
               3. If there is text in the image (like a sign or an email screen), transcribe it word-for-word.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are the primary intelligence engine for AdjusterAssist™. Your goal is to provide the 'Whole Context' of an image or document so a software developer can use it to draft claim notes."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:${mimetype};base64,${base64}` } }
                    ]
                }
            ],
            max_tokens: 1000
        });

        return `[Source: ${filename}]\n${response.choices[0].message.content}`;
    }
};

module.exports = OCRService;