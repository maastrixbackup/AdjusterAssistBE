const STATIC_RESPONSES = require("../utils/sample_response");
const Subscription = require("../models/subscription.model");

const createDraft = async (req, res) => {
    try {
        const { type } = req.body;
        const userId = req.user.id; // Extracted from your authMiddleware

        let responseText = "";

        // Exact matching based on user input type
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

        // 1. Update the database usage count
        // This increments current_usage by 1 for the logged-in user
        await Subscription.incrementUsage(userId);

        // 2. Send the exact static output
        res.status(200).json({
            success: true,
            data: responseText
        });

    } catch (error) {
        console.error("Draft Controller Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { createDraft };