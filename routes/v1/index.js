import { Router } from "express";
import { auth } from "../../utils/auth.js";
import { toNodeHandler } from "better-auth/node";

import v1ProjectRouter from "./project.routes.js";
import v1ProfileRouter from "./profile.routes.js";
import v1PlansRouter from "./plans.routes.js";
import v1CheckoutRouter from "./checkout.routes.js";
import v1PolarRouter from "./polar.routes.js";
import v1SourcesRouter from "./sources.routes.js";
import v1JobRouter from "./job.routes.js";
import v1ChatRouter from "./chat.routes.js";
const v1Router = Router();

v1Router.all('/auth/*splat', toNodeHandler(auth));
v1Router.use("/projects", v1ProjectRouter);
v1Router.use("/profile", v1ProfileRouter);
v1Router.use("/plans", v1PlansRouter);
v1Router.use("/checkout", v1CheckoutRouter);
v1Router.use("/polar", v1PolarRouter);
v1Router.use("/sources", v1SourcesRouter);
v1Router.use("/jobs", v1JobRouter);
v1Router.use("/chat", v1ChatRouter);
export default v1Router;