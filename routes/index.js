import { Router } from "express";
import { auth } from "../utils/auth.js";
import { toNodeHandler } from "better-auth/node";
const apiRouter = Router();

apiRouter.all('/auth/*splat', toNodeHandler(auth));

export default apiRouter;