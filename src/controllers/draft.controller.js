const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");
const Draft = require("../models/draft.model");
const  File = require("../models/file.model");
const db = require("../config/db");
const  aiService = require("../services/ai.service");


const testDraft = async (req, res) => {
    try {
        const { type, fileId } = req.body;
        const userId = req.user.id;

        if (!fileId) {
            return res.status(400).json({ success: false, message: "File ID required." });
        }

        // 1. Get Response (Static for test, or AI Service)
        let responseText = STATIC_RESPONSES[type?.toUpperCase()] || null;
        if (!responseText) {
            return res.status(400).json({ success: false, message: "Invalid type." });
        }

        // 2. Increment usage immediately (charging for the AI generation)
        await Subscription.incrementUsage(userId);

        // 3. Return ONLY the content to the frontend
        res.status(200).json({
            success: true,
            message: "Draft generated successfully.",
            data: {
                content: responseText,
                fileId: fileId,
                type: type
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Generation failed." });
    }
};

const getFileDrafts = async (req, res) => {
    try {
        // We get the fileId from the URL parameters: /api/files/:fileId/drafts
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({ success: false, message: "File ID is required" });
        }

        // Fetch drafts belonging specifically to this workspace
        const drafts = await Draft.findByFileId(fileId);

        res.status(200).json({
            success: true,
            count: drafts.length,
            drafts: drafts
        });
    } catch (error) {
        console.error("Get File Drafts Error:", error);
        res.status(500).json({ success: false, message: "Error fetching drafts for this workspace" });
    }
};

const getRecentDrafts = async (req, res) => {
    try {
        const userId = req.user.id;
        // You can let the frontend decide the limit via query params, default to 5
        const limit = parseInt(req.query.limit) || 2;

        const recentDrafts = await Draft.findRecent(userId, limit);

        res.status(200).json({
            success: true,
            count: recentDrafts.length,
            data: recentDrafts
        });
    } catch (error) {
        console.error("Recent Drafts Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch recent activity." });
    }
};

const deleteDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const userId = req.user.id;
        if (!draftId) {
            return res.status(400).json({ success: false, message: "Draft ID is required" });
        }  
        const draft = await Draft.findById(draftId);
        if (!draft) {
            return res.status(404).json({ success: false, message: "Draft not found" });
        }
        if (draft.user_id !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this draft" });
        }
        await Draft.deleteById(draftId);
        res.status(200).json({ success: true, message: "Draft deleted successfully" });
    } catch (error) {
        console.error("Delete Draft Error:", error);
        res.status(500).json({ success: false, message: "Error deleting draft" });
    }
};

const createAIDraft = async (req, res) => {
    try {
        const { type, fileId, shouldSave, userInput } = req.body;
        const userId = req.user.id;

        // 1. Fetch File Metadata first to give the AI context
        const [fileRows] = await db.query(
            "SELECT client_name, claim_number FROM files WHERE id = ?", 
            [fileId]
        );

        if (fileRows.length === 0) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { client_name, claim_number } = fileRows[0];

        // 2. Enhance the User Input with Context
        // This ensures the AI knows WHO it is writing to.
        const contextEnhancedInput = `
            Client Name: ${client_name}
            Claim Number: ${claim_number}
            Subject/Instructions: ${userInput}
        `;

        // 3. Call the Service with the enhanced context
        const aiResponse = await aiService.generateAIDraft(type, contextEnhancedInput);

        let savedDraft = null;
        if (shouldSave === true || shouldSave === "true") {
            savedDraft = await Draft.create({
                file_id: fileId,
                user_id: userId,
                draft_type: type,
                content: aiResponse
            });
        }
        
        await Subscription.incrementUsage(userId);
        res.status(200).json({
            success: true,
            message: savedDraft ? "Saved to workspace" : "Preview generated",
            data: {
                draftId: savedDraft ? savedDraft.id : null,
                claim_number,
                client_name,
                content: aiResponse
            }
        });

    } catch (error) {
        console.error("Controller Error:", error);
        res.status(500).json({ success: false, message: "AI Generation failed." });
    }
};

const saveGeneratedDraft = async (req, res) => {
    try {
        let { fileId, type, content } = req.body;
        const userId = req.user.id;

        // 1. If fileId is missing, create a new File record first
        if (!fileId) {
            const newFile = await File.create({
                user_id: userId,
                name: `New Draft - ${new Date().toLocaleDateString()}`, 
                status: 'draft'
            });
            fileId = newFile.id;
        }

        // 2. Persist the Draft to the DB using the (existing or new) fileId
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
                fileId: fileId // Returning the fileId in case it was newly created
            }
        });
    } catch (error) {
        console.error("Save Draft Error:", error);
        res.status(500).json({ success: false, message: "Save failed." });
    }
};


module.exports = { testDraft, getFileDrafts, getRecentDrafts, deleteDraft, createAIDraft, saveGeneratedDraft };