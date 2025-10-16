import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { logger } from "../config/logger.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
const JWT_SECRET =
    process.env.BETTER_AUTH_SECRET ||
    "your-secret-key-change-this-in-production";
const JWT_EXPIRES_IN = "7d";

// Sign up with email and password
export const signUp = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                error: "bad_request",
                message: "Name, email, and password are required",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: "bad_request",
                message: "Password must be at least 8 characters long",
            });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({
                error: "bad_request",
                message: "User with this email already exists",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user and account in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    name: name.trim(),
                    email: email.toLowerCase().trim(),
                    emailVerified: false,
                },
            });

            // Create account for password storage
            await tx.account.create({
                data: {
                    userId: user.id,
                    accountId: user.id,
                    providerId: "credential",
                    password: hashedPassword,
                },
            });

            return user;
        });

        // Create session
        const session = await createSession(result.id, req);

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.id, sessionId: session.id },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set cookie with domain configuration for production cross-subdomain support
        res.cookie("session-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            domain:
                process.env.NODE_ENV === "production"
                    ? ".supratimg.in"
                    : undefined,
        });

        res.status(201).json({
            user: {
                id: result.id,
                name: result.name,
                email: result.email,
                emailVerified: result.emailVerified,
                createdAt: result.createdAt,
                dietPreference: result.dietPreference,
            },
            session: {
                id: session.id,
                expiresAt: session.expiresAt,
            },
        });
    } catch (error) {
        logger.error({ error }, "Error in sign up");
        res.status(500).json({
            error: "internal_error",
            message: "An error occurred during sign up",
        });
    }
};

// Sign in with email and password
export const signIn = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                error: "bad_request",
                message: "Email and password are required",
            });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            include: {
                accounts: {
                    where: { providerId: "credential" },
                },
            },
        });

        if (!user || !user.accounts[0]?.password) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Invalid email or password",
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(
            password,
            user.accounts[0].password
        );

        if (!isValidPassword) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Invalid email or password",
            });
        }

        // Create session
        const session = await createSession(user.id, req);

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, sessionId: session.id },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set cookie with domain configuration for production cross-subdomain support
        res.cookie("session-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            domain:
                process.env.NODE_ENV === "production"
                    ? ".supratimg.in"
                    : undefined,
        });

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                dietPreference: user.dietPreference,
            },
            session: {
                id: session.id,
                expiresAt: session.expiresAt,
            },
        });
    } catch (error) {
        logger.error({ error }, "Error in sign in");
        res.status(500).json({
            error: "internal_error",
            message: "An error occurred during sign in",
        });
    }
};

// Sign out
export const signOut = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const sessionToken = req.cookies["session-token"];

        if (sessionToken) {
            try {
                const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;

                // Delete session from database
                await prisma.session
                    .delete({
                        where: { id: decoded.sessionId },
                    })
                    .catch(() => {
                        // Session might not exist, ignore error
                    });
            } catch {
                // Invalid token, ignore error
            }
        }

        // Clear cookie with same domain configuration
        res.clearCookie("session-token", {
            domain:
                process.env.NODE_ENV === "production"
                    ? ".supratimg.in"
                    : undefined,
        });

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Error in sign out");
        res.status(500).json({
            error: "internal_error",
            message: "An error occurred during sign out",
        });
    }
};

// Get current session
export const getSession = async (req: Request, res: Response) => {
    try {
        const sessionToken =
            req.cookies["session-token"] ||
            req.headers.authorization?.replace("Bearer ", "");

        if (!sessionToken) {
            return res.status(401).json({
                error: "unauthorized",
                message: "No session token provided",
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

            res.json({
                user: {
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email,
                    emailVerified: session.user.emailVerified,
                    createdAt: session.user.createdAt,
                    dietPreference: session.user.dietPreference,
                },
                session: {
                    id: session.id,
                    expiresAt: session.expiresAt,
                },
            });
        } catch (jwtError) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Invalid session token",
            });
        }
    } catch (error) {
        logger.error({ error }, "Error getting session");
        res.status(500).json({
            error: "internal_error",
            message: "An error occurred while getting session",
        });
    }
};

// Helper function to create a session
async function createSession(userId: string, req: Request) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    return await prisma.session.create({
        data: {
            userId,
            expiresAt,
            token: generateSessionToken(),
            ipAddress: req.ip || null,
            userAgent: req.get("User-Agent") || null,
        },
    });
}

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

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: "Name is required" });
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                name: name.trim(),
                dietPreference: dietPreference || null,
            },
        });

        res.json({
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                emailVerified: updatedUser.emailVerified,
                createdAt: updatedUser.createdAt,
                dietPreference: updatedUser.dietPreference,
            },
        });
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

        const sessions = await prisma.session.findMany({
            where: {
                userId: req.user.id,
                expiresAt: { gte: new Date() }, // Only active sessions
            },
            orderBy: { createdAt: "desc" },
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

        // Delete the session
        await prisma.session.delete({
            where: {
                id: sessionId,
                userId: req.user.id, // Ensure user can only delete their own sessions
            },
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
        if (!req.user || !req.session) {
            return res.status(401).json({ error: "unauthorized" });
        }

        // Delete all sessions except the current one
        await prisma.session.deleteMany({
            where: {
                userId: req.user.id,
                id: { not: req.session.id },
            },
        });

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Error revoking other sessions");
        res.status(500).json({ error: "internal_error" });
    }
};

// Change password
export const changePassword = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        const { currentPassword, newPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: "bad_request",
                message: "Current password and new password are required",
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: "bad_request",
                message: "New password must be at least 8 characters long",
            });
        }

        // Get current password hash
        const account = await prisma.account.findFirst({
            where: {
                userId: req.user.id,
                providerId: "credential",
            },
        });

        if (!account?.password) {
            return res.status(400).json({
                error: "bad_request",
                message: "No password set for this account",
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(
            currentPassword,
            account.password
        );

        if (!isValidPassword) {
            return res.status(400).json({
                error: "bad_request",
                message: "Current password is incorrect",
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await prisma.account.update({
            where: { id: account.id },
            data: { password: hashedNewPassword },
        });

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Error changing password");
        res.status(500).json({ error: "internal_error" });
    }
};

// Helper function to generate a session token
function generateSessionToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
