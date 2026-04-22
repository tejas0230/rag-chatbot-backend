import { db } from "../../drizzle/index.js";
import { source, project } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { sendToQueue } from "../../utils/queue.js";
import { ingestionJob } from "../../drizzle/schema.js";
const JOB_QUEUE_NAME = "jobs";

const UPLOAD_DIR = path.resolve("source_files");

const MIME_TO_SOURCE_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
};

export const createSource = async (req, res) => {
    const user = req.user;
    const { projectId, url } = req.body ?? {};
    const files = req.files ?? [];

    if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
    }

    const hasUrl = Boolean(url);
    const hasFiles = files.length > 0;

    if (!hasUrl && !hasFiles) {
        return res.status(400).json({ error: "Provide a url or at least one file (pdf, docx, txt)" });
    }

    if (hasUrl && hasFiles) {
        return res.status(400).json({ error: "Provide either a url or files, not both" });
    }

    try {
        // Verify the project exists and belongs to the authenticated user
        const [proj] = await db
            .select({ id: project.id, userId: project.userId })
            .from(project)
            .where(eq(project.id, projectId));

        if (!proj) {
            return res.status(404).json({ error: "Project not found" });
        }

        if (proj.userId !== user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const now = new Date();

        // ── URL source ────────────────────────────────────────────────────────
        if (hasUrl) {
            try { new URL(url); } catch {
                return res.status(400).json({ error: "Invalid URL" });
            }

            const [newSource] = await db
                .insert(source)
                .values({
                    projectId,
                    type: "url",
                    name: new URL(url).hostname,
                    url,
                    crawlDepth: 1,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();
            

            const [newJob] = await db.insert(ingestionJob).values({
                sourceId: newSource.id,
                jobType: "ingest",
                status: "queued",
                createdAt: now,
                updatedAt: now,
            }).returning();

            const enqueued = await sendToQueue(JOB_QUEUE_NAME, {
                jobId: newJob.id,
                sourceId: newSource.id,
                jobType: "ingest",
                status: "queued",
            });
            if (!enqueued) {
                console.error("[createSource] enqueue failed; leaving job as queued", { jobId: newJob.id });
            }

            return res.status(201).json({ sources: [newSource], jobId: newJob.id });
        }

        // ── File sources ──────────────────────────────────────────────────────
        const createdSources = [];
        const createdJobs = [];

        for (const file of files) {
            const mimeType = file.mimetype;
            const sourceType = MIME_TO_SOURCE_TYPE[mimeType];

            if (!sourceType) {
                return res.status(400).json({
                    error: `Unsupported file type "${mimeType}" for ${file.originalname}. Allowed: pdf, docx, txt`,
                });
            }

            const sourceId = randomUUID();
            const ext = path.extname(file.originalname).toLowerCase();
            const projectDir = path.join(UPLOAD_DIR, projectId);
            const storagePath = path.join(projectDir, `${sourceId}${ext}`);

            await fs.mkdir(projectDir, { recursive: true });
            await fs.writeFile(storagePath, file.buffer);

            const baseUrl = `${req.protocol}://${req.get("host")}`;
            const fileUrl = `${baseUrl}/api/v1/sources/public/${sourceId}/file`;

            const [newSource] = await db
                .insert(source)
                .values({
                    id: sourceId,
                    projectId,
                    type: sourceType,
                    name: path.basename(file.originalname, path.extname(file.originalname)),
                    filePath: `${projectId}/${sourceId}${ext}`,
                    url: fileUrl,
                    fileSizeBytes: file.size,
                    mimeType,
                    originalFilename: file.originalname,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            const [newJob] = await db.insert(ingestionJob).values({
                sourceId: newSource.id,
                jobType: "ingest",
                status: "queued",
                createdAt: now,
                updatedAt: now,
            }).returning();

            const enqueued = await sendToQueue(JOB_QUEUE_NAME, {
                jobId: newJob.id,
                sourceId: newSource.id,
                jobType: "ingest",
                status: "queued",
            });
            if (!enqueued) {
                console.error("[createSource] enqueue failed; leaving job as queued", { jobId: newJob.id });
            }

            createdSources.push(newSource);
            createdJobs.push(newJob);
        }

        return res.status(201).json({ sources: createdSources, jobIds: createdJobs.map((job) => job.id) });

    } catch (err) {
        console.error("createSource error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const getSources = async (req, res) => {
    const user = req.user;
    const { projectId } = req.params;

    if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
    }

    try {
        const [proj] = await db
            .select({ id: project.id, userId: project.userId })
            .from(project)
            .where(eq(project.id, projectId));

        if (!proj) {
            return res.status(404).json({ error: "Project not found" });
        }

        if (proj.userId !== user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const sources = await db
            .select({
                id: source.id,
                projectId: source.projectId,
                type: source.type,
                name: source.name,
                url: source.url,
                filePath: source.filePath,
                fileSizeBytes: source.fileSizeBytes,
                mimeType: source.mimeType,
            })
            .from(source)
            .where(eq(source.projectId, projectId));

        return res.status(200).json({ sources });
    } catch (err) {
        console.error("getSources error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteSource = async (req, res) => {
    const user = req.user;
    const { projectId, sourceId } = req.params;

    if (!projectId || !sourceId) {
        return res.status(400).json({ error: "projectId and sourceId are required" });
    }

    try {
        const [proj] = await db
            .select({ id: project.id, userId: project.userId })
            .from(project)
            .where(eq(project.id, projectId));

        if (!proj) {
            return res.status(404).json({ error: "Project not found" });
        }

        if (proj.userId !== user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const [sourceToDelete] = await db
            .select({ id: source.id, filePath: source.filePath, type: source.type })
            .from(source)
            .where(and(eq(source.id, sourceId), eq(source.projectId, projectId)));

        if (!sourceToDelete) {
            return res.status(404).json({ error: "Source not found" });
        }
        if(sourceToDelete.type === "url") {
            await db.delete(source).where(eq(source.id, sourceId));
        }
        else{
            await fs.rm(path.join(UPLOAD_DIR, sourceToDelete.filePath), { recursive: true });
            await db.delete(source).where(eq(source.id, sourceId));
        }
        
        return res.status(200).json({ message: "Source deleted successfully" });
    } catch (err) {
        console.error("deleteSource error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const getPublicSourceFile = async (req, res) => {
    const { sourceId } = req.params;

    if (!sourceId) {
        return res.status(400).json({ error: "sourceId is required" });
    }

    try {
        const [src] = await db
            .select({
                id: source.id,
                type: source.type,
                filePath: source.filePath,
                mimeType: source.mimeType,
                originalFilename: source.originalFilename,
            })
            .from(source)
            .where(eq(source.id, sourceId))
            .limit(1);

        if (!src) {
            return res.status(404).json({ error: "Source not found" });
        }

        if (src.type === "url") {
            return res.status(400).json({ error: "This source is a URL, not a file" });
        }

        if (!src.filePath) {
            return res.status(404).json({ error: "File not found" });
        }

        const diskPath = path.resolve(UPLOAD_DIR, src.filePath);
        if (!diskPath.startsWith(UPLOAD_DIR + path.sep) && diskPath !== UPLOAD_DIR) {
            return res.status(400).json({ error: "Invalid file path" });
        }

        if (!fsSync.existsSync(diskPath)) {
            return res.status(404).json({ error: "File not found" });
        }

        res.setHeader("Content-Type", src.mimeType || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `inline; filename=\"${(src.originalFilename || "source").replaceAll('\"', "")}\"`
        );

        return fsSync.createReadStream(diskPath).pipe(res);
    } catch (err) {
        console.error("getPublicSourceFile error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};