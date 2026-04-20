import { db } from "../../drizzle/index.js";
import { eq, not } from "drizzle-orm";
import { plans, plan_prices } from "../../drizzle/schema.js";


export const getAllPlans = async (req, res) => {
    try {
        const rows = await db.select({
            id: plans.id,
            name: plans.name,
            slug: plans.slug,
            max_projects: plans.max_projects,
            monthly_request_limit: plans.monthly_request_limit,
            interval: plan_prices.interval,
            polar_product_id: plan_prices.polar_product_id,
            price: plan_prices.price,
        }).from(plans).leftJoin(plan_prices, eq(plans.id, plan_prices.planId)).where(not(eq(plans.slug, "free_trial")));

        // fold plan_prices rows into { month, year } buckets per plan
        const byPlan = new Map();
        for (const row of rows) {
            const existing = byPlan.get(row.id) ?? {
                id: row.id,
                name: row.name,
                slug: row.slug,
                max_projects: row.max_projects,
                monthly_request_limit: row.monthly_request_limit,
                prices: {
                    month: {
                        polar_product_id: null,
                        price: null,
                    },
                    year: {
                        polar_product_id: null,
                        price: null,
                    },
                },
            };

            if (row.interval) {
                existing.prices[row.interval].polar_product_id = row.polar_product_id;
                existing.prices[row.interval].price = row.price;
            }

            byPlan.set(row.id, existing);
        }

        const allPlans = Array.from(byPlan.values());
        //return the plans
        return res.status(200).json({ plans: allPlans });
    }
    catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}