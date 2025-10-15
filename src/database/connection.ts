import { prisma, getDatabaseConfig, isDatabaseConfigured } from "./client.js";
import type { DatabaseResult } from "../types/database.js";

/**
 * Database connection status
 */
export interface ConnectionStatus {
    connected: boolean;
    error?: string;
    latency?: number;
}

/**
 * Test database connection with detailed status
 */
export async function testConnection(): Promise<ConnectionStatus> {
    if (!isDatabaseConfigured()) {
        return {
            connected: false,
            error: "Database URL not configured",
        };
    }

    const startTime = Date.now();

    try {
        await prisma.$connect();
        const latency = Date.now() - startTime;

        // Test with a simple query
        await prisma.$queryRaw`SELECT 1`;

        console.log(`Database connection successful (${latency}ms)`);
        return {
            connected: true,
            latency,
        };
    } catch (error) {
        const errorMessage = handleDatabaseError(error);
        console.error("Database connection failed:", errorMessage);
        return {
            connected: false,
            error: errorMessage,
        };
    }
}

/**
 * Initialize database connection with retry logic
 */
export async function initializeDatabase(
    maxRetries: number = 3
): Promise<DatabaseResult<ConnectionStatus>> {
    let lastError: string = "";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Database connection attempt ${attempt}/${maxRetries}`);

        const status = await testConnection();

        if (status.connected) {
            return {
                success: true,
                data: status,
            };
        }

        lastError = status.error || "Unknown connection error";

        if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    return {
        success: false,
        error: `Failed to connect after ${maxRetries} attempts. Last error: ${lastError}`,
    };
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
    try {
        await prisma.$disconnect();
    } catch (error) {
        const errorMessage = handleDatabaseError(error);
        console.error("Error disconnecting from database:", errorMessage);
    }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<
    DatabaseResult<{ status: string; timestamp: Date }>
> {
    try {
        const result = await prisma.$queryRaw<
            [{ now: Date }]
        >`SELECT NOW() as now`;
        return {
            success: true,
            data: {
                status: "healthy",
                timestamp: result[0].now,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: handleDatabaseError(error),
        };
    }
}

/**
 * Handle database connection errors with detailed messages
 */
export function handleDatabaseError(error: any): string {
    if (!error) return "Unknown database error";

    // Prisma-specific error codes
    if (error.code) {
        switch (error.code) {
            case "P1001":
                return "Cannot reach database server. Please check your connection string and ensure the database is running.";
            case "P1002":
                return "Database server was reached but timed out. The server might be overloaded.";
            case "P1003":
                return "Database does not exist. Please create the database or check the database name.";
            case "P1008":
                return "Operations timed out. The query took too long to execute.";
            case "P1009":
                return "Database already exists.";
            case "P1010":
                return "User was denied access to the database. Check your credentials and permissions.";
            case "P1011":
                return "Error opening a TLS connection. Check your SSL configuration.";
            case "P1012":
                return "Schema validation error. The database schema doesn't match your Prisma schema.";
            case "P1013":
                return "Invalid database connection string provided.";
            case "P1014":
                return "The underlying database model does not exist.";
            case "P1015":
                return "Your Prisma schema is using features that are not supported by the database.";
            case "P1016":
                return "Raw query failed. Check your SQL syntax.";
            case "P1017":
                return "Server has closed the connection. The database might be restarting.";
            case "P2002":
                return "Unique constraint violation. A record with this value already exists.";
            case "P2003":
                return "Foreign key constraint violation. Referenced record does not exist.";
            case "P2025":
                return "Record not found. The requested record does not exist.";
            default:
                return `Database error (${error.code}): ${
                    error.message || "Unknown error"
                }`;
        }
    }

    // Generic error handling
    if (error.message) {
        return error.message;
    }

    return "Unknown database error occurred";
}

/**
 * Execute database operation with error handling
 */
export async function executeWithErrorHandling<T>(
    operation: () => Promise<T>
): Promise<DatabaseResult<T>> {
    try {
        const data = await operation();
        return {
            success: true,
            data,
        };
    } catch (error) {
        return {
            success: false,
            error: handleDatabaseError(error),
        };
    }
}

export { prisma };
