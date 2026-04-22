import { db } from "../drizzle/index.js";
import { project, subscription, plans, project_usage } from "../drizzle/schema.js";
import { and, eq } from "drizzle-orm";

/**
 * Validates that the project exists, the owner has an active subscription,
 * and the monthly request limit has not been reached.
 *
 * Attaches to the request object on success:
 *   req.chatProject  – { id, userId }
 *   req.usageContext – { userId, requestCount, monthlyRequestLimit }
 */
export async function checkRequestLimit(req, res, next) {
    try {
        const { projectId } = req.body ?? {};

        if (!projectId) {
            return res.status(400).json({ error: "projectId is required" });
        }

        // 1) Resolve project → userId
        const [proj] = await db
            .select({ id: project.id, userId: project.userId })
            .from(project)
            .where(eq(project.id, projectId))
            .limit(1);

        if (!proj) {
            return res.status(404).json({ error: "Project not found" });
        }

        const { userId } = proj;

        // 2) Resolve subscription → planId
        const [sub] = await db
            .select({ planId: subscription.planId, status: subscription.status })
            .from(subscription)
            .where(eq(subscription.userId, userId))
            .limit(1);

        if (!sub) {
            return res.status(403).json({ error: "No subscription found for this user" });
        }

        // 3) Resolve plan → monthly_request_limit
        const [plan] = await db
            .select({ monthlyRequestLimit: plans.monthly_request_limit })
            .from(plans)
            .where(eq(plans.id, sub.planId))
            .limit(1);

        if (!plan) {
            return res.status(403).json({ error: "Plan not found" });
        }

        // 4) Resolve current usage for this project
        const [usage] = await db
            .select({ requestCount: project_usage.request_count })
            .from(project_usage)
            .where(
                and(
                    eq(project_usage.projectId, projectId),
                    eq(project_usage.userId, userId)
                )
            )
            .limit(1);

        const requestCount = usage?.requestCount ?? 0;

        // 5) Enforce limit
        if (requestCount >= plan.monthlyRequestLimit) {
            return res.status(429).json({ error: "Monthly request limit reached" });
        }

        req.chatProject  = { id: proj.id, userId };
        req.usageContext = { userId, requestCount, monthlyRequestLimit: plan.monthlyRequestLimit };

        next();
    } catch (err) {
        console.error("checkRequestLimit error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
