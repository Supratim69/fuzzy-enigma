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

const router = express.Router();

// Get all favorites for a user
router.get("/users/:userId/favorites", getUserFavorites);

// Get favorites count for a user
router.get("/users/:userId/favorites/count", getFavoritesCount);

// Add a recipe to favorites
router.post("/users/:userId/favorites", addFavorite);

// Batch operations
router.post("/users/:userId/favorites/batch", batchAddFavorites);
router.delete("/users/:userId/favorites/batch", batchRemoveFavorites);

// Check if a recipe is favorited
router.get("/users/:userId/favorites/:recipeId/status", getFavoriteStatus);

// Toggle favorite status
router.post("/users/:userId/favorites/:recipeId/toggle", toggleFavorite);

// Restore a deleted favorite
router.post("/users/:userId/favorites/:recipeId/restore", restoreFavorite);

// Remove a recipe from favorites
router.delete("/users/:userId/favorites/:recipeId", removeFavorite);

export default router;
