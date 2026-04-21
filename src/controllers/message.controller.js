const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");
const Message = require("../models/message.model");
const File = require("../models/workspace.model");
const aiService = require("../services/ai.service");
const PayloadBuilder = require("../utils/payloadBuilder");
const supabase = require("../config/supabase");
const UserModel = require("../models/user");
const { default: classifierService } = require("../services/classifierService");
const { getMandatoryNextStep } = require("../utils/workflowMatrix");
const { storeBase64Image } = require("../services/storageService");
const { supabaseStorage } = require("../services/supabaseStorage");
const OCRService = require("../services/ocrService")

const fs = require('fs');
const path = require('path');

// Example usage in your controller
const uploadDir = path.join(__dirname, '../uploads');


const testCreateMessage = async (req, res) => {
    try {
        const { workspace_id, user_input, image_input_url } = req.body;
        const userId = req.user.id;

        // 1. Simulate AI Classification and Logic (Internal)
        // In production, this data comes from your OpenAI/Workflow engine
        const aiSimulatedResponse = "AI drafts a short insured update while keeping claim context visible.";
        const classification = "email_insured";
        const nextStep = "Confirm document review timing";
        const actions = ["Edit Email", "Send Now", "Create File Note"];

        // 2. Save the entire interaction as ONE single row
        const turnResult = await Message.create({
            workspace_id,
            user_id: userId,
            user_input: user_input,
            image_input_url: image_input_url || null,
            ai_response: aiSimulatedResponse,
            content_type: classification,
            claim_state: 'document_collection_pending',
            next_step_suggestion: nextStep,
            quick_actions: actions,
            activity_type: 'communication_sent',
            metadata: {
                engine_version: "1.0.0",
                confidence_score: 0.95
            }
        });

        // 3. Return the single object to the frontend
        console.log("Test Create Message Result:", turnResult.id);
        return res.status(201).json({
            success: true,
            data: turnResult
        });

    } catch (error) {
        console.error("Interaction Creation Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
/**
 * 2. Get File Drafts: Fetches all drafts for a specific workspace
 */
const getFileDrafts = async (req, res) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({ success: false, message: "File ID is required" });
        }

        const drafts = await Message.findByFileId(fileId);

        res.status(200).json({
            success: true,
            count: drafts.length,
            drafts: drafts
        });
    } catch (error) {
        console.error("Get File Drafts Error:", error.message);
        res.status(500).json({ success: false, message: "Error fetching drafts for this workspace" });
    }
};

/**
 * 3. All Drafts: Comprehensive history for the current user
 */
const AllDrafts = async (req, res) => {
    try {
        const userId = req.user.id;
        const drafts = await Message.findAllByUser(userId);
        res.status(200).json({
            success: true,
            count: drafts.length,
            data: drafts
        });
    } catch (error) {
        console.error("All Drafts Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch draft history." });
    }
};

/**
 * 4. Recent Drafts: Quick view activity (limited)
 */
const getRecentDrafts = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 2;

        const recentDrafts = await Message.findRecent(userId, limit);

        res.status(200).json({
            success: true,
            count: recentDrafts.length,
            data: recentDrafts
        });
    } catch (error) {
        console.error("Recent Drafts Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch recent activity." });
    }
};


const deleteDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const userId = req.user.id;

        const draft = await Message.findById(draftId);
        if (!draft) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Security check: Ensure user owns the draft
        if (draft.user_id !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized deletion" });
        }

        await Message.deleteById(draftId);
        res.status(200).json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
        console.error("Delete Message Error:", error.message);
        res.status(500).json({ success: false, message: "Error deleting draft" });
    }
};

const createAIDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;
    const files = req.files || [];

    try {
        // 1. Destructure new refinement fields from body
        const {
            userInput,
            fileId,
            parentMessageId = null,
            refinementType = null,
            variantLabel = null
        } = req.body;

        // 1. Storage - Isolated (Non-blocking)
        let attachmentUrls = [];
        try {
            attachmentUrls = await supabaseStorage.uploadAttachments(files);
        } catch (storageErr) {
            console.error("Non-critical Storage Error:", storageErr.message);
        }

        let ocrInsights = "No attachments processed.";
        let parentMessage = null;

        // 2. LOGIC BRANCH: NEW CHAT vs. REFINEMENT
        if (parentMessageId) {
            // REFINEMENT: Fetch parent to inherit OCR insights and attachments
            console.log(`[Supabase Call] Fetching OCR Insights from parent message Id: {parentMessageId}`)
            parentMessage = await Message.findById(parentMessageId);
            if (parentMessage) {
                ocrInsights = parentMessage.ocrInsights || "No previous insights.";
            }
        } else if (files.length > 0) {
            // NEW CHAT: Process new files( OCR extract)
            try {
                console.log(`[OCR Service] Extracting insights from ${files.length} files...`);
                ocrInsights = await OCRService.extractInsights(files);
            } catch (ocrErr) {
                console.error("OCR extraction failed:", ocrErr.message);
                ocrInsights = "Technical error: Could not extract document insights.";
            }
        }

        // Inherit URLs if refining, otherwise use new uploads
        const primaryImageUrl = attachmentUrls.find(url =>
            url.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp)$/)
        ) || (parentMessage ? parentMessage.image_input_url : null);

        const documentUrl = attachmentUrls.find(url =>
            url.toLowerCase().match(/\.(pdf|docx|doc|txt|rtf|csv|xlsx|xls)$/)
        ) || (parentMessage ? parentMessage.doccuments_url : null);

        // 2. Thread History & Context
        let conversationContext = "";
        try {
            const previousMessages = await Message.findByFileId(fileId);
            conversationContext = previousMessages.slice(-5).map(msg => (
                `User: ${msg.user_input}\nAI: ${msg.ai_response}`
            )).join('\n\n');
        } catch (e) { console.error("History fetch failed:", e.message); }

        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ message: "Workspace not found" });

        const userProfile = await UserModel.findById(userId) || { name: "Adjuster", role: "Field Adjuster" };


        let detectedType;
        if (refinementType || variantLabel) {
            const classificationInput = refinementType || variantLabel;

            console.log(`[SERVICE]: Classifying Output Format using Action: ${classificationInput}`);
            detectedType = await classifierService.classify(classificationInput).catch(() => 'file_note');
        } else {
            console.log("[SERVICE]: Classifying Output Format using UserInput");
            detectedType = await classifierService.classify(userInput).catch(() => 'file_note');
        }


        // 3. AI Generation (Enhanced with Refinement Context)
        const fullPayload = PayloadBuilder.build(file, {
            conversationHistory: conversationContext,
            output_type: detectedType,
            role: userProfile.role,
            inputText: userInput,
            userInfo: {
                sender_name: userProfile.name,
                sender_designation: userProfile.role,
                sender_company: userProfile.company || "AdjusterAssist™"
            },
            ocrData: ocrInsights,
            originalResponse: parentMessage ? parentMessage.ai_response : null,
            refinementAction: refinementType,
            variant: variantLabel
        });

        const aiRawResponse = await aiService.generateAIDraft(
            detectedType,
            JSON.stringify(fullPayload),
            files
        );

        // 4. Parsing Logic
        let nextAction = "Continue monitoring the claim...";
        let dynamicSuggestions = ["Review file", "Contact insured"];

        const nextStepMatch = aiRawResponse.match(/(?:next\s*steps?|recommended\s*action):\s*(.*)/i);
        const suggestionMatch = aiRawResponse.match(/(?:suggestions|quick\s*actions|suggested\s*actions):\s*(.*)/i);

        if (suggestionMatch) dynamicSuggestions = suggestionMatch[1].split('|').map(s => s.trim());
        if (nextStepMatch) nextAction = nextStepMatch[1].trim();

        const cleanMainContent = aiRawResponse
            .replace(/(?:next\s*steps?|recommended\s*action):[\s\S]*$/i, '')
            .replace(/(?:suggestions|quick\s*actions|suggested\s*actions):[\s\S]*$/i, '')
            .trim();

        // 5. Database Operations (Now supporting Hierarchy)
        let turnResult;
        try {
            turnResult = await Message.create({
                workspace_id: fileId,
                user_id: userId,
                parent_id: parentMessageId, // Links this version to the parent
                variant_label: variantLabel || (parentMessageId ? "Refinement" : "Original"),
                refinement_type: refinementType,
                user_input: userInput,
                image_input_url: primaryImageUrl,
                doccuments_url: documentUrl,
                ai_response: cleanMainContent,
                ocrInsights: ocrInsights,
                content_type: detectedType,
                claim_state: file.claim_stage || 'review_pending',
                next_step_suggestion: nextAction,
                quick_actions: dynamicSuggestions,
                activity_type: parentMessageId ? 'ai_refinement' : 'ai_generation',
                metadata: {
                    model: "gpt-4o",
                    is_refinement: !!parentMessageId,
                    parent_id: parentMessageId
                }
            })
            if (turnResult) {

                console.log("Message turn Saved with ID: ", turnResult.id)
            }

        } catch (dbErr) {
            console.error("Critical DB Error:", dbErr.message);
            turnResult = { id: Date.now(), created_at: new Date().toISOString() };
        }

        // 6. Secondary Logging (Refinement Aware)
        try {
            const { data: logEntry, error: logError } = await supabase
                .from('ai_logs')
                .insert([{
                    file_id: parseInt(fileId),
                    user_id: userId,

                    // Hierarchy & Versioning Columns
                    parent_log_id: parentMessageId ? parseInt(parentMessageId) : null,
                    variant_label: variantLabel || null,
                    refinement_type: refinementType || null,

                    // Input Data
                    input_text: userInput,
                    input_type: primaryImageUrl ? 'attachment+text' : 'text',
                    input_image: primaryImageUrl,
                    doccuments_url: documentUrl,
                    ocrInsights: ocrInsights,

                    // Output Data
                    ai_response: aiRawResponse,
                    output_text: cleanMainContent,
                    output_type: detectedType,
                    suggested_next_step: nextAction,

                    // Performance & Analytics
                    execution_time_ms: Date.now() - startTime,
                    token_usage: { prompt: 0, completion: 0 },

                    metadata: {
                        model: "gpt-4o",
                        prompt_version: "adjusterassist_v1",
                        is_refinement: !!refinementType,
                        is_variant: !!variantLabel
                    }
                }])
                .select()
                .single();

            if (logError) throw logError;

            if (logEntry) {
                console.log("Logs created with ID: ", logEntry.id);
            }

            await Subscription.incrementUsage(userId);
        } catch (logErr) {
            console.error("Logging failed:", logErr.message);
        }

        // 7. Success Response
        res.status(200).json({
            success: true,
            data: {
                id: turnResult.id,
                parent_id: turnResult.parent_id,
                version_index: turnResult.version_index,
                user_input: userInput,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: nextAction,
                quick_actions: dynamicSuggestions,
                attachments: attachmentUrls,
                created_at: turnResult.created_at
            }
        });

    } catch (error) {
        console.error("CRITICAL AI Controller Error:", error);
        res.status(500).json({ success: false, message: "Generation failed" });
    } finally {
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { console.error("Cleanup error:", e); }
            }
        });
    }
};


const generateNextStepDraft = async (req, res) => {
    const userId = req.user.id;
    try {
        const { fileId, userInput, previousResponse, output_format } = req.body;

        const targetType = getMandatoryNextStep(output_format);

        // 2. FETCH CONTEXT: Get file and profile
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ message: "Workspace not found" });
        const userProfile = await UserModel.findById(userId);


        const nextStepPayload = PayloadBuilder.build(file, {
            output_type: targetType,
            role: userProfile.role || "Adjuster",
            inputText: `CONTEXT: User previously generated a ${output_format}. 
                        PREVIOUS CONTENT: ${previousResponse} 
                        ORIGINAL USER NOTES: ${userInput}
                        
                        TASK: You are now performing the mandatory next step: ${targetType}.`,
            userInfo: {
                sender_name: userProfile.name,
                sender_email: userProfile.email,
                sender_designation: userProfile.role,
                sender_company: userProfile.company || "AdjusterAssist™"
            }
        });

        const contextEnhancedInput = JSON.stringify(nextStepPayload);

        // 4. GENERATE: Call the same AI service
        const aiResponse = await aiService.generateAIDraft(
            targetType,
            contextEnhancedInput,
            null
        );

        // 5. PARSE: Split content from the new suggested next step
        let mainContent = aiResponse;
        let futureAction = "Review claim file";
        const parts = aiResponse.split(/Next steps?:\s*/i);
        if (parts.length > 1) {
            mainContent = parts[0].trim();
            futureAction = parts[1].trim();
        }

        // 6. LOG TO SUPABASE
        const { data: logData, error: logError } = await supabase
            .from('ai_logs')
            .insert([{
                file_id: parseInt(fileId),
                user_id: userId || null,
                input_text: `Workflow Chain: ${output_format} -> ${targetType} : ${userInput}`,
                input_type: 'workflow_continuation',
                output_text: aiResponse,
                output_type: targetType,
                suggested_next_step: futureAction,
            }])
            .select();

        // 7. TRACK USAGE
        await Subscription.incrementUsage(userId);

        // 8. FINAL RESPONSE
        res.status(200).json({
            success: true,
            data: {
                content: aiResponse,
                output_format: targetType,
                next_step: futureAction,
                created_at: logData ? logData[0].created_at : new Date().toISOString(),
                // log_id: logData ? logData[0].id : null
            }
        });

    } catch (error) {
        console.error("Next Step Controller Error:", error);
        res.status(500).json({ success: false, message: "Workflow continuation failed." });
    }
};


const updateDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const userId = req.user.id;

        const updateData = req.body;

        const existingMessage = await Message.findById(draftId);

        if (!existingMessage) {
            return res.status(404).json({
                success: false,
                message: "Interaction not found."
            });
        }

        if (existingMessage.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You do not own this interaction."
            });
        }


        const updatedTurn = await Message.updateById(draftId, updateData);

        return res.status(200).json({
            success: true,
            message: "Interaction updated successfully.",
            data: updatedTurn
        });

    } catch (error) {
        console.error("Update Draft Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    testCreateMessage,
    getFileDrafts,
    getRecentDrafts,
    deleteDraft,
    createAIDraft,
    generateNextStepDraft,
    AllDrafts,
    updateDraft
};