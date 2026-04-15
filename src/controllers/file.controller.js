const File = require("../models/workspace.model");

/**
 * Creates a new Workspace (File) - All fields are now mandatory
 */
const createFile = async (req, res) => {
    try {
        const {
            claim_number,
            client_name,
            address,
            date_of_loss,
            reported_date,
            loss_type,
            policy_form,
            jurisdiction,
            line_of_business,
            claim_stage 
        } = req.body;

        const userId = req.user.id; // Populated by authMiddleware

        // 1. Strict Validation: Ensure the Adjuster has filled out the entire form
        // This prevents the PayloadBuilder from having 'null' values later
        if (!claim_number || !client_name || !address || !loss_type || !jurisdiction) {
            return res.status(400).json({
                success: false,
                message: "All fields are required to create a professional workspace."
            });
        }

        // 2. Pass the full object to the Model
        const newFile = await File.create({
            user_id: userId,
            claim_number,
            policy_form,
            client_name,
            address,
            date_of_loss,
            reported_date,
            loss_type,
            jurisdiction,
            line_of_business,
            claim_stage
        });

        res.status(201).json({
            success: true,
            message: "Workspace created successfully",
            file: newFile
        });
    } catch (error) {
        // Handle the 'Unique Constraint' error for claim_number gracefully
        if (error.message.includes("unique constraint")) {
            console.log("A workspace with this claim number already exists.")
            return res.status(400).json({
                success: false,
                message: "A workspace with this claim number already exists."
            });
        }

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
        const files = await File.findByUserId(req.user.id);

        res.status(200).json({
            success: true,
            count: files ? files.length : 0,
            files: files || []
        });
    } catch (error) {
        console.error("Fetch Files Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching your workspaces"
        });
    }
};

const getFileById = async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = parseInt(req.user.id);
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }
        if (parseInt(file.user_id) !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to access this workspace"
            });
        }
        res.status(200).json({
            success: true,
            file
        });
    } catch (error) {
        console.error("Get File By ID Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching workspace details"
        });
    }
};

/**
 * Updates an existing workspace
 */
const updateFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = parseInt(req.user.id); // Ensure integer comparison

        const existingFile = await File.findById(fileId);

        if (!existingFile) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }

        // Security Check: Compare as Integers
        if (parseInt(existingFile.user_id) !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to update this workspace"
            });
        }

        const updatedFile = await File.update(fileId, req.body);

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

/**
 * Deletes a workspace and its associated data
 */
const deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = parseInt(req.user.id);

        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ success: false, message: "Workspace not found" });
        }

        if (parseInt(file.user_id) !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this workspace" });
        }

        await File.delete(fileId);

        res.status(200).json({
            success: true,
            message: "Workspace deleted successfully"
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
    deleteFile,
    getFileById
};