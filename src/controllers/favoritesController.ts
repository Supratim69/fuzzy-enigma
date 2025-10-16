import { type Request, type Response } from "express";
import { favoriteRepository } from "../repositories/FavoriteRepository.js";
import type { CreateFavoriteInput } from "../types/database.js";
import type { AuthenticatedRequest } from "../middleware/manualAuth.js";

/**
 * Get all active favorites for a user
 * GET /api/favorites or GET /api/users/:userId/favorites
 */
export async function getUserFavorites(
    req: AuthenticatedRequest,
    res: Response
) {
    try {
        // Get userId from authenticated user (session-based) or URL params (backward compatibility)
        const userId = req.user?.id || req.params.userId;
        const includeDeleted = req.query.includeDeleted === "true";

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // For backward compatibility, check if user is accessing their own data when using URL params
        if (
            req.params.userId &&
            req.user?.id &&
            req.params.userId !== req.user.id
        ) {
            return res
                .status(403)
                .json({ error: "You can only access your own favorites" });
        }

        const result = await favoriteRepository.findByUserId(userId, {
            includeDeleted,
        });

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        return res.json({
            favorites: result.data,
            count: result.data?.length || 0,
        });
    } catch (error) {
        console.error("getUserFavorites error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Add a recipe to user's favorites
 * POST /api/favorites or POST /api/users/:userId/favorites
 */
export async function addFavorite(req: AuthenticatedRequest, res: Response) {
    try {
        // Get userId from authenticated user (session-based) or URL params (backward compatibility)
        const userId = req.user?.id || req.params.userId;
        const { recipeId, recipeName, recipeImage, cuisine } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // For backward compatibility, check if user is accessing their own data when using URL params
        if (
            req.params.userId &&
            req.user?.id &&
            req.params.userId !== req.user.id
        ) {
            return res
                .status(403)
                .json({ error: "You can only access your own favorites" });
        }

        if (!recipeId || !recipeName) {
            return res.status(400).json({
                error: "Recipe ID and recipe name are required",
            });
        }

        const favoriteData: CreateFavoriteInput = {
            userId,
            recipeId,
            recipeName,
            recipeImage,
            cuisine,
        };

        const result = await favoriteRepository.create(favoriteData);

        if (!result.success) {
            if (result.error?.includes("already in favorites")) {
                return res.status(409).json({ error: result.error });
            }
            return res.status(400).json({ error: result.error });
        }

        return res.status(201).json({
            message: "Recipe added to favorites",
            favorite: result.data,
        });
    } catch (error) {
        console.error("addFavorite error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Remove a recipe from user's favorites (soft delete)
 * DELETE /api/users/:userId/favorites/:recipeId
 */
export async function removeFavorite(req: AuthenticatedRequest, res: Response) {
    try {
        const userId = req.user?.id || req.params.userId;
        const { recipeId } = req.params;

        if (!userId || !recipeId) {
            return res.status(400).json({
                error: "User ID and Recipe ID are required",
            });
        }

        // For backward compatibility, check if user is accessing their own data when using URL params
        if (
            req.params.userId &&
            req.user?.id &&
            req.params.userId !== req.user.id
        ) {
            return res
                .status(403)
                .json({ error: "You can only access your own favorites" });
        }

        // First find the favorite to get its ID
        const favoriteResult = await favoriteRepository.findByUserAndRecipe(
            userId,
            recipeId
        );

        if (!favoriteResult.success || !favoriteResult.data) {
            return res.status(404).json({
                error: "Favorite not found",
            });
        }

        const deleteResult = await favoriteRepository.softDelete(
            favoriteResult.data.id
        );

        if (!deleteResult.success) {
            return res.status(400).json({ error: deleteResult.error });
        }

        return res.json({
            message: "Recipe removed from favorites",
        });
    } catch (error) {
        console.error("removeFavorite error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Check if a recipe is favorited by a user
 * GET /api/users/:userId/favorites/:recipeId/status
 */
export async function getFavoriteStatus(
    req: AuthenticatedRequest,
    res: Response
) {
    try {
        const userId = req.user?.id || req.params.userId;
        const { recipeId } = req.params;

        if (!userId || !recipeId) {
            return res.status(400).json({
                error: "User ID and Recipe ID are required",
            });
        }

        // For backward compatibility, check if user is accessing their own data when using URL params
        if (
            req.params.userId &&
            req.user?.id &&
            req.params.userId !== req.user.id
        ) {
            return res
                .status(403)
                .json({ error: "You can only access your own favorites" });
        }

        const isFavorited = await favoriteRepository.isFavorited(
            userId,
            recipeId
        );

        return res.json({
            isFavorited,
            userId,
            recipeId,
        });
    } catch (error) {
        console.error("getFavoriteStatus error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Toggle favorite status for a recipe
 * POST /api/users/:userId/favorites/:recipeId/toggle
 */
export async function toggleFavorite(req: AuthenticatedRequest, res: Response) {
    try {
        const userId = req.user?.id || req.params.userId;
        const { recipeId } = req.params;
        const { recipeName, recipeImage, cuisine } = req.body;

        // For backward compatibility, check if user is accessing their own data when using URL params
        if (
            req.params.userId &&
            req.user?.id &&
            req.params.userId !== req.user.id
        ) {
            return res
                .status(403)
                .json({ error: "You can only access your own favorites" });
        }

        if (!userId || !recipeId) {
            return res.status(400).json({
                error: "User ID and Recipe ID are required",
            });
        }

        if (!recipeName) {
            return res.status(400).json({
                error: "Recipe name is required for adding to favorites",
            });
        }

        const favoriteData: CreateFavoriteInput = {
            userId,
            recipeId,
            recipeName,
            recipeImage,
            cuisine,
        };

        const result = await favoriteRepository.toggleFavorite(favoriteData);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({
            message: `Recipe ${result.action} ${
                result.action === "added" ? "to" : "from"
            } favorites`,
            action: result.action,
            favorite: result.data,
        });
    } catch (error) {
        console.error("toggleFavorite error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Restore a previously deleted favorite
 * POST /api/users/:userId/favorites/:recipeId/restore
 */
export async function restoreFavorite(req: Request, res: Response) {
    try {
        const { userId, recipeId } = req.params;

        if (!userId || !recipeId) {
            return res.status(400).json({
                error: "User ID and Recipe ID are required",
            });
        }

        const result = await favoriteRepository.restore(userId, recipeId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({
            message: "Favorite restored successfully",
            favorite: result.data,
        });
    } catch (error) {
        console.error("restoreFavorite error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Batch add multiple recipes to favorites
 * POST /api/users/:userId/favorites/batch
 */
export async function batchAddFavorites(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { favorites } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        if (!Array.isArray(favorites) || favorites.length === 0) {
            return res.status(400).json({
                error: "Favorites array is required and cannot be empty",
            });
        }

        // Validate each favorite has required fields
        for (const favorite of favorites) {
            if (!favorite.recipeId || !favorite.recipeName) {
                return res.status(400).json({
                    error: "Each favorite must have recipeId and recipeName",
                });
            }
        }

        const result = await favoriteRepository.batchCreate(userId, favorites);

        return res.json({
            message: "Batch operation completed",
            success: result.success,
            created: result.created,
            skipped: result.skipped,
            errors: result.errors,
            summary: {
                total: favorites.length,
                created: result.created.length,
                skipped: result.skipped.length,
                failed: result.errors.length,
            },
        });
    } catch (error) {
        console.error("batchAddFavorites error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Batch remove multiple recipes from favorites
 * DELETE /api/users/:userId/favorites/batch
 */
export async function batchRemoveFavorites(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { recipeIds } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
            return res.status(400).json({
                error: "Recipe IDs array is required and cannot be empty",
            });
        }

        const result = await favoriteRepository.batchSoftDelete(
            userId,
            recipeIds
        );

        return res.json({
            message: "Batch removal completed",
            success: result.success,
            deleted: result.deleted,
            notFound: result.notFound,
            errors: result.errors,
            summary: {
                total: recipeIds.length,
                deleted: result.deleted,
                notFound: result.notFound.length,
                failed: result.errors.length,
            },
        });
    } catch (error) {
        console.error("batchRemoveFavorites error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}

/**
 * Get favorites count for a user
 * GET /api/users/:userId/favorites/count
 */
export async function getFavoritesCount(
    req: AuthenticatedRequest,
    res: Response
) {
    try {
        const userId = req.user?.id || req.params.userId;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // For backward compatibility, check if user is accessing their own data when using URL params
        if (
            req.params.userId &&
            req.user?.id &&
            req.params.userId !== req.user.id
        ) {
            return res
                .status(403)
                .json({ error: "You can only access your own favorites" });
        }

        const count = await favoriteRepository.getActiveFavoritesCount(userId);

        return res.json({
            userId,
            count,
        });
    } catch (error) {
        console.error("getFavoritesCount error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}
