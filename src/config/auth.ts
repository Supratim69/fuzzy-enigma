import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

const prisma = new PrismaClient();

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql", // CockroachDB is PostgreSQL compatible
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Set to true if you want to require email verification
        minPasswordLength: 8,
        maxPasswordLength: 128,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
    },
    user: {
        additionalFields: {
            dietPreference: {
                type: "string",
                required: false,
            },
        },
    },
    trustedOrigins: [
        process.env.CLIENT_URL || "http://localhost:3000",
        process.env.SERVER_URL || "http://localhost:4000",
    ],
    secret:
        process.env.BETTER_AUTH_SECRET ||
        "your-secret-key-change-this-in-production",
    logger: {
        level: process.env.NODE_ENV === "development" ? "debug" : "info",
        disabled: false,
    },
});

export type Session = typeof auth.$Infer.Session;
