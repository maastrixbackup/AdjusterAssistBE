const aiService = require("../services/ai.service");
const User = require("../models/user");

const createDraft = async (req, res) => {
    try {
        const { request, source } = req.body;

        // TODO: In a real scenario, check DB here for user's monthly draft count

        const draft = await aiService.generateDraft(request, source);

        // Session-only: We return the draft but do NOT save it to the DB
        res.status(200).json({
            success: true,
            data: draft
        });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false, message: "AI generation failed" });
    }
};

module.exports = { createDraft };