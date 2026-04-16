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

/**
 * 5. Delete Message: Secure deletion
 */
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

/**
 * 6. Create AI Message: The core logic for OpenAI/Groq generation
 */
const createAIDraft = async (req, res) => {
    const userId = req.user.id;
    try {
        const { userInput, fileId, image } = req.body;
        console.log("Received AI Message Request:", { userInput, fileId, hasImage: !!image });
        console.log(image);
        // await storeBase64Image(image, 'photos');

        // 1. Get the Workspace data from DB
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ message: "Workspace not found" });

        const detectedType = await classifierService.classify(userInput);
        console.log("DETECTED TYPE:", detectedType);

        const userProfile = await UserModel.findById(userId);

        // 2. CONSTRUCT: Create the massive JSON payload automatically
        const fullPayload = PayloadBuilder.build(file, {
            output_type: detectedType,
            role: userProfile.role,
            inputText: userInput,
            userInfo: {
                sender_name: userProfile.name,
                sender_email: userProfile.email,
                sender_designation: userProfile.role,
                sender_company: userProfile.company || "AdjusterAssist™"
            }
        });

        // 3. TRANSFORM: Context mapping
        const contextEnhancedInput = JSON.stringify(fullPayload);
        // console.log("PAYLOAD:", contextEnhancedInput);

        // 4. GENERATE AI RESPONSE
        const aiResponse = await aiService.generateAIDraft(
            detectedType,
            contextEnhancedInput,
            image
        );
        console.log("AI RESPONSE:", aiResponse);

        
        let mainContent = aiResponse.toLowerCase();
        let dynamicSuggestions = ["Review claim file"]; // Default fallback

        // Use regex to find the Suggestions line
        const suggestionMatch = aiResponse.match(/suggestions:\s*(.*)/i);
        const nextStepMatch = aiResponse.match(/next steps?:\s*(.*)/i);

        if (suggestionMatch) {
            dynamicSuggestions = suggestionMatch[1].split('|').map(s => s.trim());
            mainContent = mainContent.split(/suggestions:/i)[0].trim();
        } else if (nextStepMatch) {
            // Fallback for single next step format
            dynamicSuggestions = [nextStepMatch[1].trim()];
            mainContent = mainContent.split(/next steps?:/i)[0].trim();
        }

        // 5. PARSE AI RESPONSE for Next Steps (New Feature)
        let nextAction = "Proceed with claim review";

        // Use a case-insensitive regex to split the string at "Next step:"
        const parts = aiResponse.split(/next steps?:\s*/i);

        if (parts.length > 1) {
            // Everything before "Next step:" goes to the editor
            mainContent = parts[0].trim();
            // Everything after "Next step:"
            nextAction = parts[1].trim();
        }

        const turnResult = await Message.create({
            workspace_id: fileId,
            user_id: userId,
            user_input: userInput,
            image_input_url: image || null,
            ai_response: aiResponse,
            content_type: detectedType,
            claim_state: file.claim_stage || 'document_collection_pending',
            next_step_suggestion: nextAction,
            quick_actions: dynamicSuggestions,
            activity_type: 'communication_sent',
            metadata: {
                engine_version: "1.0.0",
                confidence_score: 0.95,
                model: "gpt-4.0"
            }
        });
        if (!turnResult) {
            console.error("Failed to save AI interaction to database.");
        }

        // -------------------------

        // 6. STORE IN SUPABASE AI_LOGS
        const { data: logData, error: logError } = await supabase
            .from('ai_logs')
            .insert([{
                file_id: parseInt(fileId),
                user_id: userId || null,
                input_text: userInput,
                input_type: image ? 'image+text' : 'text',
                output_text: typeof aiResponse === 'object' ? aiResponse.content : aiResponse,
                output_type: detectedType,
                suggested_next_step: nextAction || null,
                input_image: image || null
            }])
            .select();
        if (logError) {
            console.error("Supabase Logging Error:", logError.message);
        }

        // 7. TRACK USAGE
        await Subscription.incrementUsage(userId);

        // 8. FINAL RESPONSE
        res.status(200).json({
            success: true,
            data: {
                content: aiResponse,
                output_format: detectedType,
                next_step: nextAction,
                suggestions: dynamicSuggestions,
                created_at: logData ? logData[0].created_at : new Date().toISOString(),
                // log_id: logData ? logData[0].id : null
            }
        });

    } catch (error) {
        console.error("AI Controller Error:", error);
        res.status(500).json({ success: false, message: "Generation failed" });
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

const saveGeneratedDraft = async (req, res) => {
    try {
        let { fileId, output_format, content } = req.body;
        const userId = req.user.id;

        // 1. If no workspace provided, create a generic one
        if (!fileId) {
            const newFile = await File.create({
                user_id: userId,
                claim_number: `TEMP-${Date.now()}`,
                client_name: "Unnamed Client"
            });
            fileId = newFile.id;
        }

        // 2. Persist the Message using the Supabase model
        const savedDraft = await Message.create({
            file_id: fileId,
            user_id: userId,
            draft_type: output_format,
            content: content
        });

        res.status(201).json({
            success: true,
            message: "Message saved to workspace.",
            data: {
                draftId: savedDraft.id,
                fileId: fileId
            }
        });
    } catch (error) {
        console.error("Save Message Error:", error.message);
        res.status(500).json({ success: false, message: "Save failed." });
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
    saveGeneratedDraft,
    AllDrafts,
    updateDraft
};