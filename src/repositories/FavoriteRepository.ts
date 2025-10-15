import { Prisma } from "@prisma/client";
import { prisma } from "../database/client.js";
import type {
    Favorite,
    CreateFavoriteInput,
    FavoriteQueryOptions,
    FavoriteQueryResult,
    FavoritesQueryResult,
    CreateResult,
    DeleteResult,
} from "../types/database.js";

export class FavoriteRepository {
    /**
     * Create a new favorite for a user
     * @param favoriteData - Favorite data to create
     * @returns Promise with creation result
     */
    async create(
        favoriteData: CreateFavoriteInput
    ): Promise<CreateResult<Favorite>> {
        try {
            // Validate required fields
            if (!favoriteData.userId?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "User ID is required and cannot be empty",
                };
            }

            if (!favoriteData.recipeId?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "Recipe ID is required and cannot be empty",
                };
            }

            // Recipe name validation removed - not needed with new schema

            // Check if user exists
            const userExists = await prisma.user.findUnique({
                where: { id: favoriteData.userId.trim() },
                select: { id: true },
            });

            if (!userExists) {
                return {
                    success: false,
                    created: false,
                    error: "User not found",
                };
            }

            // Check if there's an existing favorite (including soft-deleted ones)
            const existingFavorite = await prisma.favorite.findFirst({
                where: {
                    userId: favoriteData.userId.trim(),
                    recipeId: favoriteData.recipeId.trim(),
                },
                orderBy: { dateSaved: "desc" },
            });

            // If there's a soft-deleted favorite, restore it instead of creating new
            if (existingFavorite?.deletedAt) {
                const restoredFavorite = await prisma.favorite.update({
                    where: { id: existingFavorite.id },
                    data: {
                        deletedAt: null,
                        dateSaved: new Date(), // Update the date saved to current time
                    },
                });

                return {
                    success: true,
                    created: true,
                    data: restoredFavorite,
                };
            }

            // If there's an active favorite, return error
            if (existingFavorite && !existingFavorite.deletedAt) {
                return {
                    success: false,
                    created: false,
                    error: "Recipe is already in favorites",
                };
            }

            // Create new favorite (include legacy fields until migration is complete)
            const favorite = await prisma.favorite.create({
                data: {
                    userId: favoriteData.userId.trim(),
                    recipeId: favoriteData.recipeId.trim(),
                },
            });

            return {
                success: true,
                created: true,
                data: favorite,
            };
        } catch (error) {
            // Handle foreign key constraint violation
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2003") {
                    return {
                        success: false,
                        created: false,
                        error: "User not found",
                    };
                }
                if (error.code === "P2002") {
                    return {
                        success: false,
                        created: false,
                        error: "Recipe is already in favorites",
                    };
                }
            }

            return {
                success: false,
                created: false,
                error: `Failed to create favorite: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Find all active favorites for a user
     * @param userId - User ID to get favorites for
     * @param options - Query options including whether to include deleted favorites
     * @returns Promise with favorites array
     */
    async findByUserId(
        userId: string,
        options?: FavoriteQueryOptions
    ): Promise<FavoritesQueryResult> {
        try {
            if (!userId?.trim()) {
                return {
                    success: false,
                    error: "User ID is required",
                };
            }

            const whereClause: Prisma.FavoriteWhereInput = {
                userId: userId.trim(),
            };

            // By default, exclude soft-deleted favorites
            if (!options?.includeDeleted) {
                whereClause.deletedAt = null;
            }

            const favorites = await prisma.favorite.findMany({
                where: whereClause,
                include: {
                    recipe: true, // Include all recipe fields
                },
                orderBy: { dateSaved: "desc" },
            });

            return {
                success: true,
                data: favorites,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to fetch favorites: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Find a specific favorite by user and recipe
     * @param userId - User ID
     * @param recipeId - Recipe ID
     * @param options - Query options including whether to include deleted favorites
     * @returns Promise with favorite data or null if not found
     */
    async findByUserAndRecipe(
        userId: string,
        recipeId: string,
        options?: FavoriteQueryOptions
    ): Promise<FavoriteQueryResult> {
        try {
            if (!userId?.trim()) {
                return {
                    success: false,
                    error: "User ID is required",
                };
            }

            if (!recipeId?.trim()) {
                return {
                    success: false,
                    error: "Recipe ID is required",
                };
            }

            const whereClause: Prisma.FavoriteWhereInput = {
                userId: userId.trim(),
                recipeId: recipeId.trim(),
            };

            // By default, exclude soft-deleted favorites
            if (!options?.includeDeleted) {
                whereClause.deletedAt = null;
            }

            const favorite = await prisma.favorite.findFirst({
                where: whereClause,
                orderBy: { dateSaved: "desc" },
            });

            if (!favorite) {
                return {
                    success: false,
                    error: "Favorite not found",
                };
            }

            return {
                success: true,
                data: favorite,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to find favorite: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Soft delete a favorite by setting deletedAt timestamp
     * @param id - Favorite ID to soft delete
     * @returns Promise with deletion result
     */
    async softDelete(id: string): Promise<DeleteResult> {
        try {
            if (!id?.trim()) {
                return {
                    success: false,
                    deleted: false,
                    error: "Favorite ID is required",
                };
            }

            // Check if favorite exists and is not already deleted
            const existingFavorite = await prisma.favorite.findUnique({
                where: { id: id.trim() },
            });

            if (!existingFavorite) {
                return {
                    success: false,
                    deleted: false,
                    error: "Favorite not found",
                };
            }

            if (existingFavorite.deletedAt) {
                return {
                    success: false,
                    deleted: false,
                    error: "Favorite is already deleted",
                };
            }

            await prisma.favorite.update({
                where: { id: id.trim() },
                data: { deletedAt: new Date() },
            });

            return {
                success: true,
                deleted: true,
            };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2025") {
                    return {
                        success: false,
                        deleted: false,
                        error: "Favorite not found",
                    };
                }
            }

            return {
                success: false,
                deleted: false,
                error: `Failed to delete favorite: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Restore a previously soft-deleted favorite
     * @param userId - User ID
     * @param recipeId - Recipe ID
     * @returns Promise with restoration result
     */
    async restore(
        userId: string,
        recipeId: string
    ): Promise<CreateResult<Favorite>> {
        try {
            if (!userId?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "User ID is required",
                };
            }

            if (!recipeId?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "Recipe ID is required",
                };
            }

            // Find the most recent soft-deleted favorite
            const deletedFavorite = await prisma.favorite.findFirst({
                where: {
                    userId: userId.trim(),
                    recipeId: recipeId.trim(),
                    deletedAt: { not: null },
                },
                orderBy: { deletedAt: "desc" },
            });

            if (!deletedFavorite) {
                return {
                    success: false,
                    created: false,
                    error: "No deleted favorite found to restore",
                };
            }

            // Check if there's already an active favorite
            const activeFavorite = await prisma.favorite.findFirst({
                where: {
                    userId: userId.trim(),
                    recipeId: recipeId.trim(),
                    deletedAt: null,
                },
            });

            if (activeFavorite) {
                return {
                    success: false,
                    created: false,
                    error: "Recipe is already in active favorites",
                };
            }

            // Restore the favorite
            const restoredFavorite = await prisma.favorite.update({
                where: { id: deletedFavorite.id },
                data: {
                    deletedAt: null,
                    dateSaved: new Date(), // Update to current timestamp
                },
            });

            return {
                success: true,
                created: true,
                data: restoredFavorite,
            };
        } catch (error) {
            return {
                success: false,
                created: false,
                error: `Failed to restore favorite: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    // ===== UTILITY FUNCTIONS =====

    /**
     * Get only active (non-deleted) favorites for a user
     * Helper function that explicitly filters out soft-deleted favorites
     * @param userId - User ID to get active favorites for
     * @returns Promise with active favorites array
     */
    async getActiveFavorites(userId: string): Promise<FavoritesQueryResult> {
        return this.findByUserId(userId, { includeDeleted: false });
    }

    /**
     * Check if a recipe is currently favorited by a user (not soft-deleted)
     * @param userId - User ID
     * @param recipeId - Recipe ID to check
     * @returns Promise with boolean result
     */
    async isFavorited(userId: string, recipeId: string): Promise<boolean> {
        try {
            if (!userId?.trim() || !recipeId?.trim()) {
                return false;
            }

            const favorite = await prisma.favorite.findFirst({
                where: {
                    userId: userId.trim(),
                    recipeId: recipeId.trim(),
                    deletedAt: null,
                },
                select: { id: true },
            });

            return Boolean(favorite);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the count of active favorites for a user
     * @param userId - User ID
     * @returns Promise with count number
     */
    async getActiveFavoritesCount(userId: string): Promise<number> {
        try {
            if (!userId?.trim()) {
                return 0;
            }

            const count = await prisma.favorite.count({
                where: {
                    userId: userId.trim(),
                    deletedAt: null,
                },
            });

            return count;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Batch create multiple favorites for a user
     * Implements duplicate prevention logic
     * @param userId - User ID
     * @param favorites - Array of favorite data to create
     * @returns Promise with batch creation results
     */
    async batchCreate(
        userId: string,
        favorites: Omit<CreateFavoriteInput, "userId">[]
    ): Promise<{
        success: boolean;
        created: Favorite[];
        skipped: string[];
        errors: string[];
    }> {
        const results = {
            success: true,
            created: [] as Favorite[],
            skipped: [] as string[],
            errors: [] as string[],
        };

        try {
            if (!userId?.trim()) {
                results.success = false;
                results.errors.push("User ID is required");
                return results;
            }

            if (!Array.isArray(favorites) || favorites.length === 0) {
                results.success = false;
                results.errors.push(
                    "Favorites array is required and cannot be empty"
                );
                return results;
            }

            // Process each favorite individually to handle duplicates and errors gracefully
            for (const favoriteData of favorites) {
                const createResult = await this.create({
                    userId,
                    ...favoriteData,
                });

                if (createResult.success && createResult.data) {
                    results.created.push(createResult.data);
                } else if (
                    createResult.error?.includes("already in favorites")
                ) {
                    results.skipped.push(favoriteData.recipeId);
                } else {
                    results.errors.push(
                        `${favoriteData.recipeId}: ${
                            createResult.error || "Unknown error"
                        }`
                    );
                }
            }

            // Consider the operation successful if at least some favorites were created
            // or if all failures were due to duplicates
            results.success =
                results.created.length > 0 ||
                (results.errors.length === 0 && results.skipped.length > 0);

            return results;
        } catch (error) {
            results.success = false;
            results.errors.push(
                `Batch operation failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
            return results;
        }
    }

    /**
     * Batch soft delete multiple favorites by recipe IDs
     * @param userId - User ID
     * @param recipeIds - Array of recipe IDs to remove from favorites
     * @returns Promise with batch deletion results
     */
    async batchSoftDelete(
        userId: string,
        recipeIds: string[]
    ): Promise<{
        success: boolean;
        deleted: number;
        notFound: string[];
        errors: string[];
    }> {
        const results = {
            success: true,
            deleted: 0,
            notFound: [] as string[],
            errors: [] as string[],
        };

        try {
            if (!userId?.trim()) {
                results.success = false;
                results.errors.push("User ID is required");
                return results;
            }

            if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
                results.success = false;
                results.errors.push(
                    "Recipe IDs array is required and cannot be empty"
                );
                return results;
            }

            // Find all active favorites for the given recipe IDs
            const activeFavorites = await prisma.favorite.findMany({
                where: {
                    userId: userId.trim(),
                    recipeId: { in: recipeIds.map((id) => id.trim()) },
                    deletedAt: null,
                },
                select: { id: true, recipeId: true },
            });

            const foundRecipeIds = activeFavorites.map((f) => f.recipeId);
            const notFoundRecipeIds = recipeIds.filter(
                (id) => !foundRecipeIds.includes(id.trim())
            );
            results.notFound = notFoundRecipeIds;

            if (activeFavorites.length > 0) {
                // Batch update to set deletedAt timestamp
                const updateResult = await prisma.favorite.updateMany({
                    where: {
                        id: { in: activeFavorites.map((f) => f.id) },
                    },
                    data: {
                        deletedAt: new Date(),
                    },
                });

                results.deleted = updateResult.count;
            }

            results.success = true;
            return results;
        } catch (error) {
            results.success = false;
            results.errors.push(
                `Batch delete failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
            return results;
        }
    }

    /**
     * Toggle favorite status for a recipe (add if not favorited, remove if favorited)
     * @param userId - User ID
     * @param favoriteData - Favorite data for creation
     * @returns Promise with toggle result
     */
    async toggleFavorite(favoriteData: CreateFavoriteInput): Promise<{
        success: boolean;
        action: "added" | "removed";
        data?: Favorite;
        error?: string;
    }> {
        try {
            // Check current status
            const isFavorited = await this.isFavorited(
                favoriteData.userId,
                favoriteData.recipeId
            );

            if (isFavorited) {
                // Find and soft delete the active favorite
                const activeFavorite = await prisma.favorite.findFirst({
                    where: {
                        userId: favoriteData.userId.trim(),
                        recipeId: favoriteData.recipeId.trim(),
                        deletedAt: null,
                    },
                });

                if (activeFavorite) {
                    const deleteResult = await this.softDelete(
                        activeFavorite.id
                    );
                    if (deleteResult.success) {
                        return {
                            success: true,
                            action: "removed",
                        };
                    } else {
                        return {
                            success: false,
                            action: "removed",
                            error:
                                deleteResult.error ||
                                "Failed to remove favorite",
                        };
                    }
                }
            } else {
                // Add to favorites
                const createResult = await this.create(favoriteData);
                if (createResult.success && createResult.data) {
                    return {
                        success: true,
                        action: "added",
                        data: createResult.data,
                    };
                } else {
                    return {
                        success: false,
                        action: "added",
                        error: createResult.error || "Failed to add favorite",
                    };
                }
            }

            return {
                success: false,
                action: "removed",
                error: "Unexpected state in toggle operation",
            };
        } catch (error) {
            return {
                success: false,
                action: "added",
                error: `Toggle operation failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }
}

// Export singleton instance
export const favoriteRepository = new FavoriteRepository();
export default favoriteRepository;
