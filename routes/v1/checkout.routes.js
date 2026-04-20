import {Router} from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { createCheckoutURLForProduct } from "../../controllers/v1/checkout.controller.js";

const v1CheckoutRouter = Router();

v1CheckoutRouter.use(requireAuth);
v1CheckoutRouter.get("/:productId", createCheckoutURLForProduct);

export default v1CheckoutRouter;