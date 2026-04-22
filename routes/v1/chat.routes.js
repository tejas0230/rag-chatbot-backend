import { Router } from "express";

import { handleChat } from "../../controllers/v1/chat.controller.js";
import { checkRequestLimit } from "../../middleware/checkRequestLimit.js";

const v1ChatRouter = Router();

v1ChatRouter.post("/", checkRequestLimit, handleChat);

export default v1ChatRouter;