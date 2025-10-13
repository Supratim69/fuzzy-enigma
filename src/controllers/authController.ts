import type { Request, Response } from "express";
import { auth } from "../config/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { logger } from "../config/logger.js";

// Get current user profile
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        res.json({
            user: req.user,
            session: {
                id: req.session?.id,
                expiresAt: req.session?.expiresAt,
            },
        });
    } catch (error) {
        logger.error({ error }, "Error getting user profile");
        res.status(500).json({ error: "internal_error" });
    }
};

// Update user profile
export const updateProfile = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        const { name, dietPreference } = req.body;

        // You can add validation here
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: "Name is required" });
        }

        // Update user using BetterAuth's update method
        const updatedUser = await auth.api.updateUser({
            body: {
                name: name.trim(),
                // Add other fields you want to update
            },
            headers: req.headers as any,
        });

        res.json({ user: updatedUser });
    } catch (error) {
        logger.error({ error }, "Error updating user profile");
        res.status(500).json({ error: "internal_error" });
    }
};

// Get all user sessions
export const getSessions = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        const sessions = await auth.api.listSessions({
            headers: req.headers as any,
        });

        res.json({ sessions });
    } catch (error) {
        logger.error({ error }, "Error getting user sessions");
        res.status(500).json({ error: "internal_error" });
    }
};

// Revoke a specific session
export const revokeSession = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required" });
        }

        await auth.api.revokeSession({
            body: { token: sessionId },
            headers: req.headers as any,
        });

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Error revoking session");
        res.status(500).json({ error: "internal_error" });
    }
};

// Revoke all other sessions (keep current one)
export const revokeOtherSessions = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        await auth.api.revokeOtherSessions({
            headers: req.headers as any,
        });

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Error revoking other sessions");
        res.status(500).json({ error: "internal_error" });
    }
};
