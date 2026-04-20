import { Router } from "express";
import { handlePolarWebhook } from "../../controllers/v1/polar.controller.js";
const v1PolarRouter = Router();

v1PolarRouter.post("/webhook", handlePolarWebhook);

export default v1PolarRouter;