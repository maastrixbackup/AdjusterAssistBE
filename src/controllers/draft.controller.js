const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");
const Draft = require("../models/draft.model");

const createDraft = async (req, res) => {
    try {
        const { type, fileId, shouldSave } = req.body;
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

        // Only save and charge credit IF shouldSave is true
        if (shouldSave === true || shouldSave === "true") {
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

module.exports = { createDraft, getFileDrafts };