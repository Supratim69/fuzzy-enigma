import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { logger } from "../config/logger.js";

const prisma = new PrismaClient();
const JWT_SECRET =
    process.env.BETTER_AUTH_SECRET ||
    "your-secret-key-change-this-in-production";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
        dietPreference?: string | null | undefined;
    };
    session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
    };
}

export const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const sessionToken =
            req.cookies["session-token"] ||
            req.headers.authorization?.replace("Bearer ", "");

        if (!sessionToken) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Authentication required",
            });
        }

        try {
            const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;

            // Get session from database
            const session = await prisma.session.findUnique({
                where: { id: decoded.sessionId },
                include: {
                    user: true,
                },
            });

            if (!session || session.expiresAt < new Date()) {
                // Session expired or doesn't exist
                return res.status(401).json({
                    error: "unauthorized",
                    message: "Session expired or invalid",
                });
            }

            // Attach user and session to request
            req.user = {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                emailVerified: session.user.emailVerified,
                image: session.user.image,
                createdAt: session.user.createdAt,
                updatedAt: session.user.updatedAt,
                dietPreference: session.user.dietPreference,
            };

            req.session = {
                id: session.id,
                userId: session.userId,
                expiresAt: session.expiresAt,
                token: session.token,
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
            };

            next();
        } catch (jwtError) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Invalid session token",
            });
        }
    } catch (error) {
        logger.error({ error }, "Authentication error");
        return res.status(401).json({
            error: "unauthorized",
            message: "Authentication failed",
        });
    }
};

export const optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const sessionToken =
            req.cookies["session-token"] ||
            req.headers.authorization?.replace("Bearer ", "");

        if (sessionToken) {
            try {
                const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;

                // Get session from database
                const session = await prisma.session.findUnique({
                    where: { id: decoded.sessionId },
                    include: {
                        user: true,
                    },
                });

                if (session && session.expiresAt >= new Date()) {
                    // Attach user and session to request
                    req.user = {
                        id: session.user.id,
                        name: session.user.name,
                        email: session.user.email,
                        emailVerified: session.user.emailVerified,
                        image: session.user.image,
                        createdAt: session.user.createdAt,
                        updatedAt: session.user.updatedAt,
                    };

                    req.session = {
                        id: session.id,
                        userId: session.userId,
                        expiresAt: session.expiresAt,
                        token: session.token,
                        ipAddress: session.ipAddress,
                        userAgent: session.userAgent,
                    };
                }
            } catch {
                // Invalid token, continue without user
            }
        }

        next();
    } catch (error) {
        logger.debug(
            { error },
            "Optional auth failed, continuing without user"
        );
        next();
    }
};
