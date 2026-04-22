import { db } from "../../drizzle/index.js";
import { ingestionJob, source } from "../../drizzle/schema.js";
import { eq, inArray } from "drizzle-orm";


export const getJobProgress = async (req, res) => {
    try {
        const body = req.body ?? {};
        const nested = body.data ?? {};

        // Accept either { jobIds: [...] }, { jobId: "..." },
        // or axios-like payloads { data: { jobIds: [...] } }.
        const rawJobIds =
            body.jobIds ??
            nested.jobIds ??
            (body.jobId ? [body.jobId] : undefined) ??
            (nested.jobId ? [nested.jobId] : undefined);

        if (!Array.isArray(rawJobIds) || rawJobIds.length === 0) {
            return res.status(400).json({ error: "jobIds (non-empty array) is required" });
        }

        // Coerce ids to strings and remove empty values.
        const jobIds = rawJobIds.map(String).map((s) => s.trim()).filter(Boolean);
        if (jobIds.length === 0) {
            return res.status(400).json({ error: "jobIds (non-empty array) is required" });
        }

        const jobs = await db
            .select({
                id: ingestionJob.id,
                status: ingestionJob.status,
                pagesTotal: ingestionJob.pagesTotal,
                pagesDone: ingestionJob.pagesDone,
                errorMessage: ingestionJob.errorMessage,
                retryCount: ingestionJob.retryCount,
                maxRetries: ingestionJob.maxRetries,
                sourceId: ingestionJob.sourceId,
                sourceStatus: source.status,
            })
            .from(ingestionJob)
            .leftJoin(source, eq(ingestionJob.sourceId, source.id))
            .where(inArray(ingestionJob.id, jobIds));

        return res.json(jobs);
    } catch (err) {
        console.error("getJobProgress error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}