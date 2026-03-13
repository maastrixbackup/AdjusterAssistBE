const File = require("../models/file.model");

const createFile = async (req, res) => {
    try {
        const { claim_number, policy_number, client_name } = req.body;
        const userId = req.user.id;

        if (!claim_number) {
            return res.status(400).json({ success: false, message: "Claim number is required" });
        }

        const newFile = await File.create({
            user_id: userId,
            claim_number,
            policy_number,
            client_name
        });

        res.status(201).json({
            success: true,
            message: "File Workspace created successfully",
            file: newFile
        });
    } catch (error) {
        console.error("Create File Error:", error);
        res.status(500).json({ success: false, message: "Server error creating file" });
    }
};

const getMyFiles = async (req, res) => {
    try {
        const files = await File.findByUserId(req.user.id);
        res.status(200).json({ success: true, files });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching files" });
    }
};

module.exports = { createFile, getMyFiles };