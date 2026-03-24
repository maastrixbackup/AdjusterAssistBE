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
        const { type, fileId, userInput } = req.body;
        const userId = req.user.id;

        // 1. Fetch File Metadata using Supabase model
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        // 2. Enhance the User Input with context from the 'files' record
        const contextEnhancedInput = `
            Client Name: ${file.client_name}
            Claim Number: ${file.claim_number}
            Subject/Instructions: ${userInput}
        `;

        // 3. Generate AI response
        const aiResponse = await aiService.generateAIDraft(type, contextEnhancedInput);

        // let savedDraft = null;
        // if (shouldSave === true || shouldSave === "true") {
        //     savedDraft = await Draft.create({
        //         file_id: fileId,
        //         user_id: userId,
        //         draft_type: type,
        //         content: aiResponse
        //     });
        // }
        
        // 4. Record usage
        await Subscription.incrementUsage(userId);

        res.status(200).json({
            success: true,
            message: "Preview generated",
            data: {
                claim_number: file.claim_number,
                client_name: file.client_name,
                content: aiResponse
            }
        });

    } catch (error) {
        console.error("AI Controller Error:", error.message);
        res.status(500).json({ success: false, message: "AI Generation failed." });
    }
};

/**
 * 7. Save Generated Draft: Manual save for a previewed draft
 */
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

module.exports = { 
    testDraft, 
    getFileDrafts, 
    getRecentDrafts, 
    deleteDraft, 
    createAIDraft, 
    saveGeneratedDraft, 
    AllDrafts 
};