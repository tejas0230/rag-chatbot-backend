import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle/index.js";
import { subscription, plans } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    trustedOrigins: ["http://localhost:3000"],
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            accessType: "offline",
            prompt: "consent",
            scope: ["email", "profile"],
        },
    },
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            console.log(ctx.path);
            const isEmailSignUp = ctx.path === "/sign-up/email";
            // Social auth session is created at the OAuth callback, not at /sign-in/social
            const isSocialCallback = ctx.path.startsWith("/callback/");

            if (!isEmailSignUp && !isSocialCallback) return;

            const newSession = ctx.context.newSession;
            console.log(newSession);
            if (!newSession?.user) return;
            console.log(newSession.user.id);
            // For social sign-in, check if a subscription already exists to avoid
            // creating a new one on every sign-in (social has no separate sign-up path)
            const [existing] = await db
                .select({ id: subscription.id })
                .from(subscription)
                .where(eq(subscription.userId, newSession.user.id))
                .limit(1);

            if (existing) return;

            const now = new Date();
            const freeTrialDays = 3;
            const freeExpiresAt = new Date(now.getTime() + freeTrialDays * 24 * 60 * 60 * 1000);

            const [freeTrialPlan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.slug, "free_trial"));
            if (!freeTrialPlan) {
                throw new Error("Free trial plan not found");
            }

            await db.insert(subscription).values({
                id: crypto.randomUUID(),
                userId: newSession.user.id,
                plan: "free_trial",
                planId: freeTrialPlan.id,
                status: "trialing",
                freeExpiresAt,
                createdAt: now,
                updatedAt: now,
            });
        }),
    },
});