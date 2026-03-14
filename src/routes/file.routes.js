const express = require("express");
const router = express.Router();
const {createFile, getMyFiles} = require("../controllers/file.controller");
const {getFileDrafts} = require("../controllers/draft.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"File Routes Success"})
});

// Create a new File Workspace
router.post("/new", authMiddleware, createFile);

// Get all workspaces belonging to the logged-in adjuster
router.get("/my-files", authMiddleware, getMyFiles);

// Get all drafts specifically for ONE workspace
router.get("/:fileId/drafts", authMiddleware, getFileDrafts);

module.exports = router;