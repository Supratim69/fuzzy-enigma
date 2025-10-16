import express from "express";
import {
    getUserFavorites,
    addFavorite,
    removeFavorite,
    getFavoriteStatus,
    toggleFavorite,
    restoreFavorite,
    batchAddFavorites,
    batchRemoveFavorites,
    getFavoritesCount,
} from "../controllers/favoritesController.js";
import { requireAuth } from "../middleware/manualAuth.js";

const router = express.Router();

// Apply manual authentication middleware to all favorites routes
router.use(requireAuth);

// Session-based favorites routes (no userId needed in URL)
// Get all favorites for current user
router.get("/favorites", getUserFavorites);

// Get favorites count for current user
router.get("/favorites/count", getFavoritesCount);

// Add a recipe to favorites
router.post("/favorites", addFavorite);

// Batch operations
router.post("/favorites/batch", batchAddFavorites);
router.delete("/favorites/batch", batchRemoveFavorites);

// Check if a recipe is favorited
router.get("/favorites/:recipeId/status", getFavoriteStatus);

// Toggle favorite status
router.post("/favorites/:recipeId/toggle", toggleFavorite);

// Restore a deleted favorite
router.post("/favorites/:recipeId/restore", restoreFavorite);

// Remove a recipe from favorites
router.delete("/favorites/:recipeId", removeFavorite);

// Keep old routes for backward compatibility (but use manual auth)
router.get("/users/:userId/favorites", getUserFavorites);
router.get("/users/:userId/favorites/count", getFavoritesCount);
router.post("/users/:userId/favorites", addFavorite);
router.post("/users/:userId/favorites/batch", batchAddFavorites);
router.delete("/users/:userId/favorites/batch", batchRemoveFavorites);
router.get("/users/:userId/favorites/:recipeId/status", getFavoriteStatus);
router.post("/users/:userId/favorites/:recipeId/toggle", toggleFavorite);
router.post("/users/:userId/favorites/:recipeId/restore", restoreFavorite);
router.delete("/users/:userId/favorites/:recipeId", removeFavorite);

export default router;
