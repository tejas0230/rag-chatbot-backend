import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./utils/auth.js";

const app = express();

app.use(cookieParser(process.env.COOKIE_SECRET));

const allowedOrigins = [
    'http://localhost:3000'
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    })
);

app.use(helmet());
app.use(morgan('dev'));

app.use((req,res,next)=>{
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use('/health', (req,res)=>{
    res.status(200).send('OK');
});

// Fallback landing page after OAuth when no callbackURL is provided by the client.
app.get("/", (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(302, `${frontendUrl}/dashboard`);
});

app.use("/api/v1", apiRouter);

// Only mount JSON parsing after Better Auth.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/me", async (req, res) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (!session) return res.status(401).json({ error: "Unauthorized" });
    return res.json(session);
});

const PORT = process.env.PORT || 5500;

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});