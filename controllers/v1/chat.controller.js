import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { db } from "../../drizzle/index.js";
import { chunk, project_usage } from "../../drizzle/schema.js";
import { and, eq, inArray, sql } from "drizzle-orm";

export const handleChat = async (req, res) => {
    try {
        const { projectId, message } = req.body ?? {};

        if (!projectId) {
            return res.status(400).json({ error: "projectId is required" });
        }
        if (!message || typeof message !== "string" || message.trim().length === 0) {
            return res.status(400).json({ error: "message is required" });
        }

        const { userId } = req.chatProject;

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL;
        const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

        // These env keys currently have spaces in .env; support both forms.
        const QDRANT_URL = (process.env.QDRANT_URL || process.env["QDRANT_URL "])?.trim();
        const QDRANT_COLLECTION = (process.env.QDRANT_COLLECTION || process.env["QDRANT_COLLECTION "])?.trim();

        if (!OPENAI_API_KEY) {
            return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
        }
        if (!OPENAI_EMBEDDING_MODEL) {
            return res.status(500).json({ error: "OPENAI_EMBEDDING_MODEL is not configured" });
        }
        if (!QDRANT_URL || !QDRANT_COLLECTION) {
            return res.status(500).json({ error: "QDRANT_URL / QDRANT_COLLECTION is not configured" });
        }

        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        const qdrant = new QdrantClient({ url: QDRANT_URL });

        // 1) Embed the user question
        const embeddingResp = await openai.embeddings.create({
            model: OPENAI_EMBEDDING_MODEL,
            input: message,
        });

        const vector = embeddingResp?.data?.[0]?.embedding;
        if (!Array.isArray(vector)) {
            console.error("[handleChat] Invalid embedding response shape", embeddingResp);
            return res.status(500).json({ error: "Failed to create embedding" });
        }

        // 2) Similarity search in Qdrant (filtered to this projectId)
        let hits;
        try {
            const result = await qdrant.search(QDRANT_COLLECTION, {
                vector,
                limit: 8,
                with_payload: true,
                with_vector: false,
                filter: {
                    must: [
                        {
                            key: "projectId",
                            match: { value: projectId },
                        },
                    ],
                },
            });
            hits = result;
        } catch (err) {
            // If payload key is different (e.g. project_id) we still want to be resilient.
            console.warn("[handleChat] Qdrant search with projectId filter failed; retrying without filter");
            hits = await qdrant.search(QDRANT_COLLECTION, {
                vector,
                limit: 8,
                with_payload: true,
                with_vector: false,
            });
        }

        const chunkIds = (hits ?? []).map((h) => h?.id).filter(Boolean);

        // 3) Fetch chunk text from Postgres using Drizzle
        const chunks =
            chunkIds.length > 0
                ? await db
                      .select({
                          id: chunk.id,
                          chunkText: chunk.chunkText,
                          sourceId: chunk.sourceId,
                          chunkIndex: chunk.chunkIndex,
                      })
                      .from(chunk)
                      .where(and(eq(chunk.projectId, projectId), inArray(chunk.id, chunkIds)))
                : [];

        // Keep ordering aligned to Qdrant ranking
        const chunkById = new Map(chunks.map((c) => [c.id, c]));
        const orderedChunks = chunkIds.map((id) => chunkById.get(id)).filter(Boolean);

        const context = orderedChunks
            .map(
                (c, i) =>
                    `[#${i + 1}] sourceId=${c.sourceId} chunkIndex=${c.chunkIndex}\n${c.chunkText}`
            )
            .join("\n\n---\n\n");

        // 4) Ask the chat model with retrieved context
        const chatResp = await openai.chat.completions.create({
            model: OPENAI_CHAT_MODEL,
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant. Answer the user's question using the provided context when relevant. If the context is insufficient, say I don't know or I don't have information about that. Don't make up information. Also format the response nicely.",
                },
                {
                    role: "user",
                    content: `Context:\n${context || "(no relevant context found)"}\n\nQuestion:\n${message}`,
                },
            ],
        });

        const answer = chatResp?.choices?.[0]?.message?.content?.trim();
        if (!answer) {
            console.error("[handleChat] Invalid chat completion response shape", chatResp);
            return res.status(500).json({ error: "Failed to generate response" });
        }  

        await db
            .update(project_usage)
            .set({ request_count: sql`${project_usage.request_count} + 1` })
            .where(
                and(
                    eq(project_usage.projectId, projectId),
                    eq(project_usage.userId, userId)
                )
            );

        return res.json({
            answer,
            chunkIds: orderedChunks.map((c) => c.id),
        });
    } catch (err) {
        console.error("handleChat error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}