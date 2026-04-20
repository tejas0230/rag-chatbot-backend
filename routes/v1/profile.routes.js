import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getMyProfile } from "../../controllers/v1/profile.controller.js";
const v1ProfileRouter = Router();

v1ProfileRouter.use(requireAuth);
v1ProfileRouter.get("/me", getMyProfile);

export default v1ProfileRouter;