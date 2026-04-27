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

const createAIDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;
    const files = req.files || [];

    try {
        const { userInput, fileId } = req.body;

        if (!userInput?.trim()) return res.status(400).json({ message: "Input text is required" });
        if (!fileId) return res.status(400).json({ message: "Workspace context missing" });

        // 1. Storage - Upload attachments to Supabase
        let attachmentUrls = [];
        try {
            attachmentUrls = await supabaseStorage.uploadAttachments(files);
        } catch (storageErr) {
            console.error("Non-critical Storage Error:", storageErr.message);
        }

        // 2. OCR Service - Extract data from new files
        let ocrInsights = "No attachments processed.";
        if (files.length > 0) {
            try {
                console.log(`[OCR Service] Extracting insights from ${files.length} files...`);
                ocrInsights = await OCRService.extractInsights(files);
            } catch (ocrErr) {
                console.error("OCR extraction failed:", ocrErr.message);
                ocrInsights = "Technical error: Could not extract document insights.";
            }
        }

        // Extract specific URLs for DB indexing
        const primaryImageUrl = attachmentUrls.find(url =>
            url.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp)$/)
        ) || null;

        const documentUrl = attachmentUrls.find(url =>
            url.toLowerCase().match(/\.(pdf|docx|doc|txt|rtf|csv|xlsx|xls)$/)
        ) || null;

        // 3. Context & Metadata Gathering
        let conversationHistory = []; // Initialize as an array, not a string
        try {
            const previousMessages = await Message.findByFileId(fileId);

            conversationHistory = previousMessages.slice(-5).flatMap(msg => [
                { role: "user", content: msg.user_input },
                { role: "assistant", content: msg.ai_response }
            ]);
        } catch (e) {
            console.error("History fetch failed:", e.message);
        }

        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ message: "Workspace not found" });

        const userProfile = await UserModel.findById(userId) || { name: "Adjuster", role: "Field Adjuster" };

        // 4. Classification & AI Generation
        console.log("[SERVICE]: Classifying Output Format...");
        const detectedType = await classifierService.classify(userInput).catch(() => 'file_note');

        const fullPayload = PayloadBuilder.build(file, {
            output_type: detectedType,
            role: userProfile.role,
            inputText: userInput,
            ocrData: ocrInsights,
            files: files,
            userInfo: {
                sender_name: userProfile.name,
                sender_designation: userProfile.role,
                sender_email: userProfile.email,
                sender_company: "AdjusterAssist™"
            }
        });

        const aiRawResponse = await aiService.generateAIDraft(
            detectedType,
            JSON.stringify(fullPayload),
            files,
            conversationHistory
        );

        // 5. Parsing AI Response for metadata
        let nextAction = "Continue monitoring the claim.";
        let dynamicSuggestions = ["Review file", "Contact insured"];

        const nextStepMatch = aiRawResponse.match(/(?:next\s*steps?|recommended\s*action):\s*(.*)/i);
        const suggestionMatch = aiRawResponse.match(/(?:suggestions|quick\s*actions|suggested\s*actions):\s*(.*)/i);

        if (suggestionMatch) dynamicSuggestions = suggestionMatch[1].split('|').map(s => s.trim());
        if (nextStepMatch) nextAction = nextStepMatch[1].trim();

        const cleanMainContent = aiRawResponse
            .replace(/(?:next\s*steps?|recommended\s*action):[\s\S]*$/i, '')
            // .replace(/(?:suggestions|quick\s*actions|suggested\s*actions):[\s\S]*$/i, '')
            .trim();

        // 6. Database Operations - Save Main Message Turn
        let turnResult;
        try {
            turnResult = await Message.create({
                workspace_id: fileId,
                user_id: userId,
                parent_id: null, // Always a parent message
                variant_label: "Original",
                user_input: userInput,
                image_input_url: primaryImageUrl,
                doccuments_url: documentUrl,
                ai_response: cleanMainContent,
                ocrInsights: ocrInsights,
                content_type: detectedType,
                claim_state: file.claim_stage || 'review pending',
                next_step_suggestion: nextAction,
                quick_actions: dynamicSuggestions,
                activity_type: 'ai_generation',
                metadata: {
                    model: "gpt-4o",
                }
            });
            console.log("Message turn Saved with ID: ", turnResult.id);
        } catch (dbErr) {
            console.error("Critical DB Error:", dbErr.message);
            turnResult = { id: Date.now(), created_at: new Date().toISOString() };
        }

        // 7. Secondary Logging & Usage Tracking
        try {
            const { data: logEntry, error: logError } = await supabase
                .from('ai_logs')
                .insert([{
                    file_id: parseInt(fileId),
                    user_id: userId,
                    parent_log_id: null,
                    input_text: userInput,
                    input_type: primaryImageUrl ? 'attachment+text' : 'text',
                    input_image: primaryImageUrl,
                    doccuments_url: documentUrl,
                    ocrInsights: ocrInsights,
                    ai_response: aiRawResponse,
                    output_text: cleanMainContent,
                    output_type: detectedType,
                    suggested_next_step: nextAction,
                    execution_time_ms: Date.now() - startTime,
                    payload: fullPayload,
                    metadata: {
                        model: "gpt-4o",
                        prompt_version: "adjusterassist_v1",
                        is_refinement: false,
                        is_variant: false
                    }
                }])
                .select()
                .single();
            console.log("Log Id:", logEntry.id)

            if (logError) throw logError;
            await Subscription.incrementUsage(userId);
        } catch (logErr) {
            console.error("Logging failed:", logErr.message);
        }

        // 8. Success Response
        res.status(200).json({
            success: true,
            data: {
                id: turnResult.id,
                user_input: userInput,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: nextAction,
                quick_actions: dynamicSuggestions,
                image_input_url: primaryImageUrl,
                doccuments_url: documentUrl,
                created_at: turnResult.created_at
            }
        });

    } catch (error) {
        console.error("CRITICAL AI Controller Error:", error);
        res.status(500).json({ success: false, message: "Generation failed" });
    } finally {
        // Cleanup local temp files
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { console.error("Cleanup error:", e); }
            }
        });
    }
};


const createVariantDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;
    try {
        const {
            userInput,
            fileId,
            parentMessageId,
            variantLabel
        } = req.body;
        console.log("DEBUG BODY:", req.body)

        // 1. Validation - Variant MUST have a parent
        if (!parentMessageId) {
            return res.status(400).json({ message: "Variant generation requires a parentMessageId" });
        }

        // 2. Fetch Parent Context (Inherit OCR and previous data)
        const parentMessage = await Message.findById(parentMessageId);
        if (!parentMessage) {
            return res.status(404).json({ message: "Parent message not found" });
        }

        const ocrInsights = parentMessage.ocrInsights || "No previous insights.";
        const file = await File.findById(fileId);
        const userProfile = await UserModel.findById(userId) || { name: "Adjuster", role: "Field Adjuster" };

        let detectedType = "";
        if (variantLabel.toLowerCase() == "email") {
            detectedType = "email_insured"
        } else {
            detectedType = await classifierService.classify(variantLabel)
        }

        console.log(`[VARIANT]: Transforming content to format: ${detectedType}`);

        const fullPayload = await PayloadBuilder.buildVariant(file, {
            variantLabel: variantLabel,
            originalContent: userInput || parentMessage.ai_response,
            userInfo: userProfile,
            parentMessage: parentMessage
        });

        const aiRawResponse = await aiService.generateAIDraft(
            detectedType,
            JSON.stringify(fullPayload),
            [],
            // parentMessage
        );

        let nextAction = "Continue monitoring the claim.";
        let dynamicSuggestions = ["Review file", "Contact insured"];

        const nextStepMatch = aiRawResponse.match(/(?:next\s*steps?|recommended\s*action):\s*(.*)/i);
        const suggestionMatch = aiRawResponse.match(/(?:suggestions|quick\s*actions|suggested\s*actions):\s*(.*)/i);

        if (suggestionMatch) dynamicSuggestions = suggestionMatch[1].split('|').map(s => s.trim());
        if (nextStepMatch) nextAction = nextStepMatch[1].trim();

        const cleanMainContent = aiRawResponse
            .replace(/(?:next\s*steps?|recommended\s*action):[\s\S]*$/i, '')
            // .replace(/(?:suggestions|quick\s*actions|suggested\s*actions):[\s\S]*$/i, '')
            .trim();


        const updateData = {
            ai_response: cleanMainContent,
            content_type: variantLabel.toLowerCase().replace(/\s+/g, '_'),
            metadata: {
                ...parentMessage.metadata,
                is_variant: true,
                last_modified_at: new Date().toISOString(),
                refined_from_id: parentMessageId
            },
            next_step_suggestion: nextAction || "Continue monitoring claim.",
            activity_type: 'ai_variant',
            updated_at: new Date().toISOString()
        };

        const turnResult = await Message.updateById(parentMessageId, updateData);

        // 8. Log the Variant Action
        await supabase.from('ai_logs').insert([{
            file_id: parseInt(fileId),
            user_id: userId,
            parent_log_id: parseInt(parentMessageId),
            variant_label: variantLabel,
            input_text: userInput,
            ai_response: aiRawResponse,
            output_text: cleanMainContent,
            output_type: variantLabel,
            ocrInsights: null,
            execution_time_ms: Date.now() - startTime,
            metadata: {
                model: "gpt-4o",
                is_variant: true,
                source_message_id: parentMessageId
            },
            payload: fullPayload
        }]);

        await Subscription.incrementUsage(userId);

        // 9. Response
        res.status(200).json({
            success: true,
            data: {
                id: turnResult.id,
                parent_id: turnResult.parent_id,
                user_input: userInput,
                variant_label: turnResult.variant_label,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: turnResult.next_step_suggestion || parentMessage.next_step_suggestion,
                created_at: turnResult.updated_at
            }
        });

    } catch (error) {
        console.error("VARIANT Controller Error:", error);
        res.status(500).json({ success: false, message: "Variant generation failed" });
    }
};

const refineAIDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;

    try {
        const {
            userInput,
            fileId,
            parentMessageId,
            refinementType
        } = req.body;
        // console.log("DEBUG BODY:", req.body)
        // 1. Validation
        if (!parentMessageId || !refinementType || !userInput) {
            return res.status(400).json({
                message: "Refinement requires a parentMessageId and a specific refinementType and AI response."
            });
        }

        // 2. Fetch Parent Context (Inherit OCR and state)
        const parentMessage = await Message.findById(parentMessageId);
        if (!parentMessage) {
            return res.status(404).json({ message: "Original message not found." });
        }
        const detectedType = parentMessage.content_type;

        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ message: "Workspace not found." });

        // 3. Define Refinement Logic (Guardrails)
        const refinementMap = {
            shorten: "Be extremely concise. Remove introductory fluff. Focus only on the core facts and requirements.",
            formal: "Use high-level professional adjuster language. Replace casual phrasing with industry-standard terminology.",
            attorney_facing: "Ensure the tone is objective, fact-based, and legally defensible. Focus on policy compliance and documented evidence.",
            firm: "Adopt a decisive tone. State requirements or positions clearly without using soft language like 'we think' or 'perhaps'.",
            doi_safe: "Ensure language complies with Department of Insurance standards. Use transparent, non-ambiguous terms and include necessary disclosures."
        };

        const specificRule = refinementMap[refinementType] || "Improve the clarity and professionalism of the text.";

        // 4. Build Refinement Payload
        // Using the logic: Take current response + apply rule = refined response
        const fullPayload = await PayloadBuilder.buildRefinementPayload({
            originalContent: userInput || parentMessage.ai_response,
            rule: specificRule
        });

        // 5. Call AI Service
        console.log(`[REFINE]: Applying '${refinementType}' logic to Message ${parentMessageId}`);
        const aiRawResponse = await aiService.generateAIDraft(
            parentMessage.content_type,
            JSON.stringify(fullPayload),
            []
        );


        let nextAction = "Continue monitoring the claim.";
        let dynamicSuggestions = ["Review file", "Contact insured"];

        const nextStepMatch = aiRawResponse.match(/(?:next\s*steps?|recommended\s*action):\s*(.*)/i);
        const suggestionMatch = aiRawResponse.match(/(?:suggestions|quick\s*actions|suggested\s*actions):\s*(.*)/i);

        if (suggestionMatch) dynamicSuggestions = suggestionMatch[1].split('|').map(s => s.trim());
        if (nextStepMatch) nextAction = nextStepMatch[1].trim();

        const cleanMainContent = aiRawResponse
            .replace(/(?:next\s*steps?|recommended\s*action):[\s\S]*$/i, '')
            // .replace(/(?:suggestions|quick\s*actions|suggested\s*actions):[\s\S]*$/i, '')
            .trim();

        // 7. Save to Database (Version of the parent)
        const refinementUpdate = {
            ai_response: cleanMainContent,

            refinement_type: refinementType,
            activity_type: 'ai_refinement',

            next_step_suggestion: nextAction || "Continue monitoring draft.",

            metadata: {
                ...parentMessage.metadata,
                last_refinement_action: refinementType,
                is_refinement: true,
                refined_at: new Date().toISOString(),
                previous_version_content: parentMessage.ai_response
            },
            updated_at:new Date().toISOString()
        };

        // 2. Execute the update on the parentMessageId
        const turnResult = await Message.updateById(parentMessageId, refinementUpdate);

        // 8. Log the Refinement
        await supabase.from('ai_logs').insert([{
            file_id: parseInt(fileId),
            user_id: userId,
            parent_log_id: parseInt(parentMessageId),
            refinement_type: refinementType,
            input_text: userInput,
            ai_response: aiRawResponse,
            output_type: parentMessage.content_type,
            execution_time_ms: Date.now() - startTime,
            next_step_suggestion: nextAction || "Continue monitoring draft.",
            metadata: { is_refinement: true, action: refinementType, model: "gpt-4o" },
            payload: fullPayload

        }]);

        await Subscription.incrementUsage(userId);

        // 9. Response
        res.status(200).json({
            success: true,
            data: {
                id: turnResult.id,
                parent_id: parentMessageId,
                user_input: userInput,
                refinement_type: turnResult.refinement_type,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: nextAction || parentMessage.next_step_suggestion,
                created_at: turnResult.updated_at
            }
        });

    } catch (error) {
        console.error("REFINEMENT Controller Error:", error);
        res.status(500).json({ success: false, message: "Refinement failed." });
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
    updateDraft,

    createVariantDraft,
    refineAIDraft
};