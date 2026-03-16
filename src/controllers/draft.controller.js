const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");
const Draft = require("../models/draft.model");
const { generateAIDraft } = require("../services/ai.service");

const testDraft = async (req, res) => {
    try {
        const { type, fileId, save } = req.body;
        const userId = req.user.id;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "A File ID is required. All drafting must occur within a Workspace."
            });
        }

        let responseText = "";
        switch (type?.toLowerCase()) {
            case 'email': responseText = STATIC_RESPONSES.EMAIL; break;
            case 'file': responseText = STATIC_RESPONSES.FILE_NOTE; break;
            case 'escalation': responseText = STATIC_RESPONSES.ESCALATION; break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid type. Use: 'email', 'file', or 'escalation'."
                });
        }

        let savedDraft = null;

        // Only save and charge credit IF save is true
        if (save === true || save === "true") {
            savedDraft = await Draft.create({
                file_id: fileId,
                user_id: userId,
                draft_type: type,
                content: responseText
            });

            // Increment usage ONLY if it was saved
            await Subscription.incrementUsage(userId);
        }

        // 4. Return the response safely
        res.status(200).json({
            success: true,
            message: savedDraft
                ? "Draft generated and saved to workspace."
                : "Draft generated (Preview only).",
            data: {
                // Safe access: uses savedDraft.id if it exists, otherwise null
                draftId: savedDraft ? savedDraft.id : null,
                fileId: fileId,
                content: responseText
            }
        });

    } catch (error) {
        console.error("Draft Controller Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
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

        if (!fileId) {
            return res.status(400).json({ success: false, message: "File ID is required." });
        }

        // 1. Call the Service
        const aiResponse = await generateAIDraft(type, userInput);

        let savedDraft = null;
        
        // 2. Handle Persistence and Credits
        if (shouldSave === true || shouldSave === "true") {
            savedDraft = await Draft.create({
                file_id: fileId,
                user_id: userId,
                draft_type: type,
                content: aiResponse
            });

            await Subscription.incrementUsage(userId);
        }

        // 3. Final Response
        res.status(200).json({
            success: true,
            message: savedDraft ? "Saved to workspace" : "Preview generated",
            data: {
                draftId: savedDraft ? savedDraft.id : null,
                content: aiResponse
            }
        });

    } catch (error) {
        console.error("Controller Error:", error);
        
        // Specific error handling for OpenAI status codes
        if (error.status === 429) {
            return res.status(429).json({ success: false, message: "AI Quota exceeded." });
        }
        
        res.status(500).json({ success: false, message: "Server error during AI generation." });
    }
};


module.exports = { testDraft, getFileDrafts, deleteDraft, createAIDraft };