const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");
const Draft = require("../models/draft.model");

const createDraft = async (req, res) => {
    try {
        const { type, fileId } = req.body;
        const userId = req.user.id;

        // 1. Validate File Workspace presence
        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "A File ID is required. All drafting must occur within a Workspace."
            });
        }

        let responseText = "";

        // Selection logic
        switch (type?.toLowerCase()) {
            case 'email':
                responseText = STATIC_RESPONSES.EMAIL;
                break;
            case 'file':
                responseText = STATIC_RESPONSES.FILE_NOTE;
                break;
            case 'escalation':
                responseText = STATIC_RESPONSES.ESCALATION;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid type. Use: 'email', 'file', or 'escalation'."
                });
        }

        // 2. Persist the draft to the File Workspace (Permanent Storage)
        const savedDraft = await Draft.create({
            file_id: fileId,
            user_id: userId,
            draft_type: type,
            content: responseText
        });

        // 3. Update the subscription usage count
        await Subscription.incrementUsage(userId);

        // 4. Return the response including the saved record details
        res.status(200).json({
            success: true,
            message: "Draft generated and saved to workspace successfully.",
            data: {
                draftId: savedDraft.id,
                fileId: fileId,
                content: responseText
            }
        });

    } catch (error) {
        console.error("Draft Controller Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { createDraft };