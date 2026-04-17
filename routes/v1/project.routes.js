import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { db } from "../../drizzle/index.js";
import { eq, count } from "drizzle-orm";
import { project, subscription, plans, project_usage } from "../../drizzle/schema.js";

const v1ProjectRouter = Router();

//CREATE A NEW PROJECT
v1ProjectRouter.post("/", requireAuth, async (req, res) => {
    const user = req.user;
    const body = req.body ?? {};
    const { name, description, slug, aiMode } = body;

    // validate the request body
    if (!name || !slug || !aiMode) {
        return res.status(400).json({ error: "name, slug, and aiMode are required" });
    }
    if (!["platform", "byok"].includes(aiMode)) {
        return res.status(400).json({ error: "aiMode must be 'platform' or 'byok'" });
    }

    try {
        // get the user's subscription joined with their plan limits
        const [userSub] = await db
            .select({
                plan: subscription.plan,
                status: subscription.status,
                freeExpiresAt: subscription.freeExpiresAt,
                max_projects: plans.max_projects,
            })
            .from(subscription)
            .innerJoin(plans, eq(subscription.planId, plans.id))
            .where(eq(subscription.userId, user.id));

        if (!userSub) {
            return res.status(403).json({ error: "No active subscription found" });
        }

        // get the number of projects the user currently has
        const [{ projectCount }] = await db
            .select({ projectCount: count() })
            .from(project)
            .where(eq(project.userId, user.id));

        // check if the user has reached the maximum number of projects
        if (projectCount >= userSub.max_projects) {
            return res.status(403).json({
                error: `Project limit reached. Your plan allows a maximum of ${userSub.max_projects} project(s).`,
            });
        }

        // create the project
        const now = new Date();
        const [newProject] = await db
            .insert(project)
            .values({
                userId: user.id,
                name,
                description: description ?? null,
                slug,
                ai_mode: aiMode,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        // create project usage record
        await db.insert(project_usage).values({
            userId: user.id,
            projectId: newProject.id,
            is_byok: aiMode === "byok",
            request_count: 0,
            createdAt: now,
            updatedAt: now,
        });

        return res.status(201).json({ project: newProject });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "A project with that slug already exists" });
        }
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

//GET ALL PROJECTS FOR A USER
v1ProjectRouter.get("/", requireAuth, async (req, res) => {
    
});

//GET A PROJECT BY ID
v1ProjectRouter.get("/:id", requireAuth, async (req, res) => {

})

//UPDATE A PROJECT
v1ProjectRouter.put("/:id", requireAuth, async (req, res) => {

})

//DELETE A PROJECT
v1ProjectRouter.delete("/:id", requireAuth, async (req, res) => {
    
})

export default v1ProjectRouter;