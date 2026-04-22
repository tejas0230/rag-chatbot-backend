import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/requireAuth.js";
import { createSource, getSources, deleteSource, getPublicSourceFile } from "../../controllers/v1/sources.controller.js";

const v1SourcesRouter = Router();

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,  // 50 MB per file
        files: 10,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: pdf, docx, txt`));
        }
    },
});

// Public file access (no auth)
v1SourcesRouter.get("/public/:sourceId/file", getPublicSourceFile);

v1SourcesRouter.use(requireAuth);

v1SourcesRouter.get("/:projectId", getSources);
v1SourcesRouter.post("/", upload.array("files", 10), createSource);
v1SourcesRouter.delete("/:sourceId/project/:projectId", deleteSource);

export default v1SourcesRouter;
