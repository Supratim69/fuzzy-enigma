import { PrismaClient, Prisma } from "@prisma/client";
import type { DatabaseConfig } from "../types/database.js";

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

/**
 * Database configuration with defaults
 */
const databaseConfig: DatabaseConfig = {
    url: process.env.DATABASE_URL || "",
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "10"),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || "10000"),
};

/**
 * Create Prisma client with proper configuration
 */
function createPrismaClient(): PrismaClient {
    const logLevel: Prisma.LogLevel[] =
        process.env.NODE_ENV === "production"
            ? ["error"]
            : ["query", "info", "warn", "error"];

    return new PrismaClient({
        log: logLevel,
        datasources: {
            db: {
                url: databaseConfig.url,
            },
        },
    });
}

/**
 * Global Prisma client instance with connection reuse in development
 */
const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prisma;
}

/**
 * Get database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
    return { ...databaseConfig };
}

/**
 * Check if database URL is configured
 */
export function isDatabaseConfigured(): boolean {
    return Boolean(databaseConfig.url);
}

export { prisma };
export default prisma;
