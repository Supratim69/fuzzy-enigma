import app from "./app.js";
import { logger } from "./config/logger.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, `Server listening on port ${PORT}`);
});

process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down");
    server.close(() => {
        logger.info("Server closed");
        process.exit(0);
    });
});

process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down");
    server.close(() => {
        logger.info("Server closed");
        process.exit(0);
    });
});
