import { Router } from "express";

import { getJobProgress } from "../../controllers/v1/job.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const v1JobRouter = Router();

v1JobRouter.use(requireAuth);
v1JobRouter.post("/progress", getJobProgress);

export default v1JobRouter;