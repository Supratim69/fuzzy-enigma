import type { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth.js";
import { logger } from "../config/logger.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
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
        const session = await auth.api.getSession({
            headers: req.headers as any,
        });

        if (!session) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Authentication required",
            });
        }

        req.user = session.user;
        req.session = session.session;
        next();
    } catch (error) {
        logger.error({ error }, "Authentication error");
        return res.status(401).json({
            error: "unauthorized",
            message: "Invalid session",
        });
    }
};

export const optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const session = await auth.api.getSession({
            headers: req.headers as any,
        });

        if (session) {
            req.user = session.user;
            req.session = session.session;
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
