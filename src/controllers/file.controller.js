const File = require("../models/file.model");

/**
 * Creates a new Workspace (File) linked to the authenticated user
 */
const createFile = async (req, res) => {
    try {
        const { claim_number, policy_number, client_name } = req.body;
        const userId = req.user.id; // From Auth Middleware

        // Validation: Claim Number is mandatory for AdjusterAssist workspaces
        if (!claim_number) {
            return res.status(400).json({ 
                success: false, 
                message: "Claim number is required to create a workspace" 
            });
        }

        const newFile = await File.create({
            user_id: userId,
            claim_number,
            policy_number,
            client_name
        });

        res.status(201).json({
            success: true,
            message: "Workspace created successfully",
            file: newFile // Now returns the full object from Supabase including the ID
        });
    } catch (error) {
        console.error("Create File Error:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Server error creating workspace" 
        });
    }
};

/**
 * Fetches all workspaces owned by the logged-in user
 */
const getMyFiles = async (req, res) => {
    try {
        // req.user.id is populated by your authMiddleware
        const files = await File.findByUserId(req.user.id);
        
        res.status(200).json({ 
            success: true, 
            count: files.length,
            files 
        });
    } catch (error) {
        console.error("Fetch Files Error:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching your workspaces" 
        });
    }
};

module.exports = { 
    createFile, 
    getMyFiles 
};