import { Router } from "express";
import { getAllPlans } from "../../controllers/v1/plans.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const v1PlansRouter = Router();
            
v1PlansRouter.use(requireAuth);
v1PlansRouter.get("/", getAllPlans);

export default v1PlansRouter;