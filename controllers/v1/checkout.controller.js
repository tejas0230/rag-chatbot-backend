import 'dotenv/config';
import { db } from "../../drizzle/index.js";
import { Polar } from "@polar-sh/sdk";
import { plans, plan_prices } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";


const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: process.env.POLAR_MODE || 'sandbox' 
})

export const createCheckoutURLForProduct = async (req, res) => {
    try{
        const { productId } = req.params;
        const user = req.user;

        const checkout = await polar.checkouts.create({
            products: [productId],
            externalCustomerId: user.id,
            customerEmail: user.email,
            successUrl: `${process.env.FRONTEND_URL}/dashboard/billing?checkout_id={CHECKOUT_ID}`,
        });

        return res.status(200).json({
            checkout_url: checkout.url,
        });
    }
    catch(error){
        return res.status(500).json({ error: "Internal server error" });
    }
}