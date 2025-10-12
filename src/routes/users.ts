import express from "express";
import {
    createUser,
    getUserById,
    getUserByEmail,
    updateUser,
    deleteUser,
    getAllUsers,
    checkEmailExists,
} from "../controllers/usersController.js";

const router = express.Router();

// Get all users
router.get("/users", getAllUsers);

// Create a new user
router.post("/users", createUser);

// Get user by ID
router.get("/users/:userId", getUserById);

// Update user
router.put("/users/:userId", updateUser);

// Delete user
router.delete("/users/:userId", deleteUser);

// Get user by email
router.get("/users/email/:email", getUserByEmail);

// Check if email exists
router.get("/users/email/:email/exists", checkEmailExists);

export default router;
