const express = require("express");
const router = express.Router();
const {createFile, getMyFiles, updateFile, deleteFile} = require("../controllers/file.controller");
const {getFileDrafts} = require("../controllers/draft.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"File Routes Success"})
});

router.post("/new", authMiddleware, createFile);
router.get("/my-files", authMiddleware, getMyFiles);
router.get("/:fileId/drafts", authMiddleware, getFileDrafts);
router.put('/update/:fileId', authMiddleware, updateFile);
router.delete("/delete/:fileId", authMiddleware, deleteFile)

module.exports = router;