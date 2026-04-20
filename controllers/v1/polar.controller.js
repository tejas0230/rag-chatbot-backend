import "dotenv/config";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { eq } from "drizzle-orm";
import { db } from "../../drizzle/index.js";
import { subscription, plan_prices, plans } from "../../drizzle/schema.js";

export const handlePolarWebhook = async (req, res) => {
    try {
        const raw = req.rawBody;
        if (!Buffer.isBuffer(raw) && typeof raw !== "string") {
            return res.status(400).json({ error: "Missing raw body for webhook verification" });
        }
        const event = validateEvent(raw, req.headers, process.env.POLAR_WEBHOOK_SECRET);
        switch (event.type) {
            case "subscription.created":
                await handleSubscriptionCreated(event);
                break;
            case "subscription.canceled":
                await handleSubscriptionCanceled(event);
                break;
            default:
                return res.status(400).json({ error: "Invalid event type" });
        }
        return res.status(200).json({ message: "Event received" });
    }
    catch (error) {
        if (error instanceof WebhookVerificationError) {
            return res.status(403).send("");
        }
        console.error(error);
        return res.status(500).json({ error: "Webhook handler failed" });
    }
}


async function handleSubscriptionCreated(event) {
    const polarSub = event.data;
    const { id, status, currentPeriodStart, currentPeriodEnd, customer, product, productId } = polarSub;

    const userId = customer?.externalId;
    if (!userId) {
        console.warn("subscription.created: missing customer.externalId");
        return;
    }

    const polarProductId = product?.id ?? productId;
    const [pricePlan] = await db
        .select({
            planId: plan_prices.planId,
            slug: plans.slug,
        })
        .from(plan_prices)
        .innerJoin(plans, eq(plan_prices.planId, plans.id))
        .where(eq(plan_prices.polar_product_id, polarProductId))
        .limit(1);

    if (!pricePlan) {
        console.warn("subscription.created: no plan_prices row for polar product", polarProductId);
        return;
    }

    const now = new Date();
    const [updated] = await db
        .update(subscription)
        .set({
            planId: pricePlan.planId,
            plan: pricePlan.slug,
            status: mapPolarSubscriptionStatus(status),
            providerSubscriptionId: id,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            freeExpiresAt: pricePlan.slug === "free_trial" ? undefined : null,
            updatedAt: now,
        })
        .where(eq(subscription.userId, userId))
        .returning({ id: subscription.id });

    if (!updated) {
        console.warn("subscription.created: no local subscription row for user", userId);
    }
}

/** @param {string} polarStatus */
function mapPolarSubscriptionStatus(polarStatus) {
    const s = String(polarStatus).toLowerCase();
    const allowed = new Set(["active", "inactive", "trialing", "past_due", "canceled", "unpaid"]);
    if (allowed.has(s)) return s;
    if (s === "incomplete" || s === "incomplete_expired") return "trialing";
    return "inactive";
}

async function handleSubscriptionCanceled(event) {
    const polarSub = event.data;
    const { id, status, currentPeriodStart, currentPeriodEnd, customer, product, productId } = polarSub;

    const userId = customer?.externalId;
    if (!userId) {
        console.warn("subscription.canceled: missing customer.externalId");
        return;
    }

    const [updated] = await db
        .update(subscription)
        .set({
            status: "canceled",
            updatedAt: now,
        })
        .where(eq(subscription.userId, userId));
        
    if (!updated) {
        console.warn("subscription.canceled: no local subscription row for user", userId);
    }
}