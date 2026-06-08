const express = require("express");
const router = express.Router();
const {createFile, getMyFiles, updateFile, deleteFile, getFileById} = require("../controllers/file.controller");
const {getFileDrafts} = require("../controllers/message.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const requireAAL2 = require("../middlewares/requireAAL2");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"File Routes Success"})
});

router.post("/new", authMiddleware,requireAAL2, createFile);
router.get("/my-files", authMiddleware, getMyFiles);
router.get("/:fileId", authMiddleware, getFileById);
router.get("/:fileId/drafts", authMiddleware, getFileDrafts);
router.put('/update/:fileId', authMiddleware, requireAAL2, updateFile);
router.delete("/delete/:fileId", authMiddleware, requireAAL2 ,deleteFile)

module.exports = router;