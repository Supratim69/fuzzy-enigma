import express from "express";
import {
    createUser,
    getUserById,
    getUserByEmail,
    updateUser,
    deleteUser,
    getAllUsers,
    checkEmailExists,
    getDietPreference,
} from "../controllers/usersController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Public routes
// Check if email exists (public for registration)
router.get("/users/email/:email/exists", checkEmailExists);

// Protected routes (require authentication)
// Get all users (admin only - for now just require auth)
router.get("/users", requireAuth, getAllUsers);

// Create a new user (might be used internally)
router.post("/users", requireAuth, createUser);

// Get user by ID (protected)
router.get("/users/:userId", requireAuth, getUserById);

// Get user's diet preference (protected)
router.get("/users/:userId/diet-preference", requireAuth, getDietPreference);

// Update user (protected)
router.put("/users/:userId", requireAuth, updateUser);

// Delete user (protected)
router.delete("/users/:userId", requireAuth, deleteUser);

// Get user by email (protected)
router.get("/users/email/:email", requireAuth, getUserByEmail);

export default router;
