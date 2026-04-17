import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../utils/auth.js";

/**
 * Validates the incoming request's session via better-auth.
 * Attaches `req.user` and `req.session` on success, or returns 401.
 */
export async function requireAuth(req, res, next) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.user = session.user;
        req.session = session.session;

        next();
    } catch (err) {
        console.error("Session validation error:", err);
        return res.status(401).json({ error: "Unauthorized" });
    }
}
