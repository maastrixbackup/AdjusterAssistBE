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

const updateFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.id; // From authMiddleware
        const { client_name, status, claim_number, policy_number } = req.body;

        // 1. First, check if the file exists and belongs to the user
        const existingFile = await File.findById(fileId);

        if (!existingFile) {
            return res.status(404).json({ 
                success: false, 
                message: "Workspace not found" 
            });
        }

        // 2. Security Check: Prevent users from updating files they don't own
        if (existingFile.user_id !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: "Unauthorized to update this workspace" 
            });
        }

        // 3. Perform the update using your Supabase model
        const updatedFile = await File.update(fileId, {
            client_name,
            status,
            claim_number,
            policy_number
        });

        res.status(200).json({
            success: true,
            message: "Workspace updated successfully",
            file: updatedFile
        });
    } catch (error) {
        console.error("Update File Error:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Server error updating workspace" 
        });
    }
};

const deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.id;

        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ success: false, message: "Workspace not found" });
        }

        if (file.user_id !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this workspace" });
        }

        await File.delete(fileId);

        res.status(200).json({
            success: true,
            message: "Workspace and all associated drafts deleted successfully"
        });
    } catch (error) {
        console.error("Delete File Controller Error:", error.message);
        res.status(500).json({ success: false, message: "Error deleting workspace" });
    }
};

module.exports = { 
    createFile, 
    getMyFiles,
    updateFile,
    deleteFile
};