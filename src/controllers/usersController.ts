import { type Request, type Response } from "express";
import { userRepository } from "../repositories/UserRepository.js";
import type { CreateUserInput, UpdateUserInput } from "../types/database.js";

/**
 * Create a new user
 * POST /api/users
 */
export async function createUser(req: Request, res: Response) {
    try {
        const { name, email, authProvider, avatarUrl, dietPreference } =
            req.body;

        if (!name || !email || !authProvider) {
            return res.status(400).json({
                error: "Name, email, and auth provider are required",
            });
        }

        const userData: CreateUserInput = {
            name,
            email,
            authProvider,
            avatarUrl,
            dietPreference,
        };

        const result = await userRepository.create(userData);

        if (!result.success) {
            if (result.error?.includes("Email already exists")) {
                return res.status(409).json({ error: result.error });
            }
            return res.status(400).json({ error: result.error });
        }

        return res.status(201).json({
            message: "User created successfully",
            user: result.data,
        });
    } catch (error) {
        console.error("createUser error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Get user by ID
 * GET /api/users/:userId
 */
export async function getUserById(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const result = await userRepository.findById(userId);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        return res.json({
            user: result.data,
        });
    } catch (error) {
        console.error("getUserById error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Get user by email
 * GET /api/users/email/:email
 */
export async function getUserByEmail(req: Request, res: Response) {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const result = await userRepository.findByEmail(email);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        return res.json({
            user: result.data,
        });
    } catch (error) {
        console.error("getUserByEmail error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Update user
 * PUT /api/users/:userId
 */
export async function updateUser(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { name, email, authProvider, avatarUrl, dietPreference } =
            req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const updateData: UpdateUserInput = {};

        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (authProvider !== undefined) updateData.authProvider = authProvider;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (dietPreference !== undefined)
            updateData.dietPreference = dietPreference;

        const result = await userRepository.update(userId, updateData);

        if (!result.success) {
            if (result.error?.includes("Email already exists")) {
                return res.status(409).json({ error: result.error });
            }
            if (result.error?.includes("User not found")) {
                return res.status(404).json({ error: result.error });
            }
            return res.status(400).json({ error: result.error });
        }

        return res.json({
            message: "User updated successfully",
            user: result.data,
            previousData: result.previousData,
        });
    } catch (error) {
        console.error("updateUser error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Delete user
 * DELETE /api/users/:userId
 */
export async function deleteUser(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const result = await userRepository.delete(userId);

        if (!result.success) {
            if (result.error?.includes("User not found")) {
                return res.status(404).json({ error: result.error });
            }
            return res.status(400).json({ error: result.error });
        }

        return res.json({
            message: "User deleted successfully",
        });
    } catch (error) {
        console.error("deleteUser error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Get all users
 * GET /api/users
 */
export async function getAllUsers(req: Request, res: Response) {
    try {
        const limit = req.query.limit
            ? parseInt(req.query.limit as string)
            : undefined;
        const offset = req.query.offset
            ? parseInt(req.query.offset as string)
            : undefined;

        const options: { limit?: number; offset?: number } = {};
        if (limit !== undefined) options.limit = limit;
        if (offset !== undefined) options.offset = offset;

        const result = await userRepository.findAll(options);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({
            users: result.data,
            count: result.data?.length || 0,
        });
    } catch (error) {
        console.error("getAllUsers error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Check if email exists
 * GET /api/users/email/:email/exists
 */
export async function checkEmailExists(req: Request, res: Response) {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const exists = await userRepository.emailExists(email);

        return res.json({
            email,
            exists,
        });
    } catch (error) {
        console.error("checkEmailExists error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}
