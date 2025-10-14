import express from "express";
import cors from "cors";
import { default as helmet } from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { logger } from "./config/logger.js";
import authRouter from "./routes/auth.js";
import searchRouter from "./routes/search.js";
// import smartSearchRouter from "./routes/smartSearch.js";
import recipesRouter from "./routes/recipes.js";
import matchRouter from "./routes/match.js";
import uploadRouter from "./routes/upload.js";
import favoritesRouter from "./routes/favorites.js";
import usersRouter from "./routes/users.js";

dotenv.config();

const app = express();

app.use(helmet());

// CORS configuration for frontend integration
app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            const allowedOrigins = [
                process.env.CLIENT_URL || "http://localhost:3000",
                "http://localhost:3000",
                "https://recipe-chef.vercel.app",
                "https://chef.supratimg.in",
            ];

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true, // Allow cookies to be sent
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Accept",
            "Origin",
        ],
        exposedHeaders: ["Set-Cookie"],
    })
);

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
    morgan("combined", {
        stream: { write: (msg: string) => logger.info(msg.trim()) },
    })
);

app.get("/health", (_req, res) =>
    res.status(200).json({ status: "ok", uptime: process.uptime() })
);

// Auth routes (must be before other API routes)
app.use("/api", authRouter); // All auth endpoints: /api/auth/*

app.use("/api", searchRouter); // POST /api/search
// app.use("/api", smartSearchRouter); // POST /api/smart-search --- removing this as it doesn't make sense to have two search endpoints
app.use("/api", recipesRouter); // GET  /api/recipes/:parentId
app.use("/api", matchRouter); // POST /api/recipes/match

app.use("/api", uploadRouter); // POST /api/upload
app.use("/api", favoritesRouter); // Favorites API endpoints
app.use("/api", usersRouter); // Users API endpoints

app.use((_req, res) => res.status(404).json({ error: "not_found" }));

app.use(
    (
        err: any,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
    ) => {
        logger.error({ err }, "Unhandled error");
        res.status(err.status || 500).json({
            error: err.message || "internal_error",
        });
    }
);

export default app;
