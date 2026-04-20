import { db } from "../../drizzle/index.js";
import { subscription, plans, project } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";

function isSubscriptionActive(sub) {
    if (!sub) return false;
  
    if (sub.plan === "free_trial") {
      return new Date() < sub.freeExpiresAt;
    }
  
    return sub.status === "active" || sub.status === "trialing";
}

export const getMyProfile = async (req, res) => {
    try{
         //get the user's profile data
        const user = req.user;
        //get the user's subscription data
        const [userSubscription] = await db.select({
            id: subscription.id,
            plan: plans,
            status: subscription.status,
            freeExpiresAt: subscription.freeExpiresAt,
        }).from(subscription).leftJoin(plans, eq(subscription.planId, plans.id)).where(eq(subscription.userId, user.id));
        //get the user's projects
        const projects = await db.select().from(project).where(eq(project.userId, user.id));
        //return the user's profile data
        return res.status(200).json({ 
            user, 
            userSubscription: userSubscription ?? null, 
            projects: projects ?? [],
            meta: {
                isActive: isSubscriptionActive(userSubscription),
                plan: userSubscription?.plan ?? "free_trial",
            }
        });
    }
    catch(error){
        return res.status(500).json({ error: "Internal server error" });
    }
}