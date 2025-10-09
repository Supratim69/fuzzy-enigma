import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { logger } from "./config/logger.js";
import searchRouter from "./routes/search.js";
import smartSearchRouter from "./routes/smartSearch.js";
import recipesRouter from "./routes/recipes.js";
import matchRouter from "./routes/match.js";

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    morgan("combined", {
        stream: { write: (msg: string) => logger.info(msg.trim()) },
    })
);

app.get("/health", (_req, res) =>
    res.status(200).json({ status: "ok", uptime: process.uptime() })
);

app.use("/api", searchRouter); // POST /api/search
app.use("/api", smartSearchRouter); // POST /api/smart-search
app.use("/api", recipesRouter); // GET  /api/recipes/:parentId
app.use("/api", matchRouter); // POST /api/recipes/match

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
