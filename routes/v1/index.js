import { Router } from "express";
import { auth } from "../../utils/auth.js";
import { toNodeHandler } from "better-auth/node";

import v1ProjectRouter from "./project.routes.js";
import v1ProfileRouter from "./profile.routes.js";
import v1PlansRouter from "./plans.routes.js";

const v1Router = Router();

v1Router.all('/auth/*splat', toNodeHandler(auth));
v1Router.use("/projects", v1ProjectRouter);
v1Router.use("/profile", v1ProfileRouter);
v1Router.use("/plans", v1PlansRouter);

export default v1Router;