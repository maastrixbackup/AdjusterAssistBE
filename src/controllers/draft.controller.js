const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");
const Draft = require("../models/draft.model");
const File = require("../models/file.model");
const aiService = require("../services/ai.service");

/**
 * 1. Test Draft: Uses static responses to simulate AI for testing UI
 */
const testDraft = async (req, res) => {
    try {
        const { type, fileId } = req.body;
        const userId = req.user.id;

        if (!fileId) {
            return res.status(400).json({ success: false, message: "File ID required." });
        }

        let responseText = STATIC_RESPONSES[type?.toUpperCase()] || null;
        if (!responseText) {
            return res.status(400).json({ success: false, message: "Invalid type." });
        }

        // Use Supabase model to increment usage
        await Subscription.incrementUsage(userId);

        res.status(200).json({
            success: true,
            message: "Draft generated successfully (Test Mode).",
            data: {
                content: responseText,
                fileId: fileId,
                type: type
            }
        });
    } catch (error) {
        console.error("Test Draft Error:", error.message);
        res.status(500).json({ success: false, message: "Generation failed." });
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

        const drafts = await Draft.findByFileId(fileId);

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
        const drafts = await Draft.findAllByUser(userId);
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

        const recentDrafts = await Draft.findRecent(userId, limit);

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
 * 5. Delete Draft: Secure deletion
 */
const deleteDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const userId = req.user.id;

        const draft = await Draft.findById(draftId);
        if (!draft) {
            return res.status(404).json({ success: false, message: "Draft not found" });
        }

        // Security check: Ensure user owns the draft
        if (draft.user_id !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized deletion" });
        }

        await Draft.deleteById(draftId);
        res.status(200).json({ success: true, message: "Draft deleted successfully" });
    } catch (error) {
        console.error("Delete Draft Error:", error.message);
        res.status(500).json({ success: false, message: "Error deleting draft" });
    }
};

/**
 * 6. Create AI Draft: The core logic for OpenAI/Groq generation
 */
const createAIDraft = async (req, res) => {
    try {
        // 1. Extract all 4 parameters from the user request
        const { 
            type,         // 'email', 'file', or 'escalation'
            fileId,       // Reference to the workspace
            userInput,    // The rough notes or raw data
            task_type     // 'claim_note_drafting', 'damage_evaluation_drafting', etc.
        } = req.body;

        const userId = req.user.id;

        // 2. Fetch File Metadata for context
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ 
                success: false, 
                message: "Workspace not found. Cannot provide claim context." 
            });
        }

        // 3. Enhance the Input with workspace metadata
        // This gives the AI the "Who" and "What" before the task logic begins
        const contextEnhancedInput = `
            WORKSPACE CONTEXT:
            - Client Name: ${file.client_name}
            - Claim Number: ${file.claim_number}

            USER NOTES/INSTRUCTIONS:
            ${userInput}
        `;

        // 4. Generate AI response using the dynamic 3-argument service
        // Passing: format type, the enhanced input, and the specific assistant task
        const aiResponse = await aiService.generateAIDraft(type, contextEnhancedInput, task_type);

        // 5. Record subscription usage
        await Subscription.incrementUsage(userId);

        // 6. Return response with original metadata for the UI
        res.status(200).json({
            success: true,
            message: "Assistant draft generated successfully",
            data: {
                claim_number: file.claim_number,
                client_name: file.client_name,
                content: aiResponse,
                task_applied: task_type,
                format_applied: type
            }
        });

    } catch (error) {
        console.error("AI Controller Error:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "AI Generation failed. Please check your service configuration." 
        });
    }
};


const saveGeneratedDraft = async (req, res) => {
    try {
        let { fileId, type, content } = req.body;
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

        // 2. Persist the Draft using the Supabase model
        const savedDraft = await Draft.create({
            file_id: fileId,
            user_id: userId,
            draft_type: type,
            content: content
        });

        res.status(201).json({
            success: true,
            message: "Draft saved to workspace.",
            data: {
                draftId: savedDraft.id,
                fileId: fileId
            }
        });
    } catch (error) {
        console.error("Save Draft Error:", error.message);
        res.status(500).json({ success: false, message: "Save failed." });
    }
};

const updateDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const { content, draft_type } = req.body;
        const userId = req.user.id; 
        // 1. First, verify the draft exists and belongs to this user
        const existingDraft = await Draft.findById(draftId);

        if (!existingDraft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found."
            });
        }

        if (existingDraft.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You do not have permission to edit this draft."
            });
        }

        // 2. Perform the update
        const updatedData = {
            content: content || existingDraft.content,
            draft_type: draft_type || existingDraft.draft_type
        };

        const updatedDraft = await Draft.updateById(draftId, updatedData);

        return res.status(200).json({
            success: true,
            message: "Draft updated successfully",
            data: updatedDraft
        });

    } catch (error) {
        console.error("Error in updateDraft controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = { 
    testDraft, 
    getFileDrafts, 
    getRecentDrafts, 
    deleteDraft, 
    createAIDraft, 
    saveGeneratedDraft, 
    AllDrafts,
    updateDraft
};