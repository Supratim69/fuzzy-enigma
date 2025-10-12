/**
 * Database configuration types
 */
export interface DatabaseConfig {
    url: string;
    maxConnections?: number;
    connectionTimeout?: number;
}

/**
 * Common database operation result types
 */
export interface DatabaseResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Pagination options for database queries
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
    offset?: number;
}

/**
 * Soft delete interface for models that support soft deletion
 */
export interface SoftDeletable {
    deletedAt?: Date | null;
}

/**
 * Timestamp interface for models with created/updated timestamps
 */
export interface Timestamped {
    createdAt: Date;
    updatedAt: Date;
}

/**
 * User entity interface matching Prisma User model
 */
export interface User extends Timestamped {
    id: string;
    name: string;
    email: string;
    authProvider: string;
    avatarUrl?: string | null;
    dietPreference?: string | null;
}

/**
 * Favorite entity interface matching Prisma Favorite model with soft delete support
 */
export interface Favorite extends SoftDeletable {
    id: string;
    userId: string;
    recipeId: string;
    recipeName: string;
    recipeImage?: string | null;
    cuisine?: string | null;
    dateSaved: Date;
}

/**
 * Input types for database operations
 */

// User input types
export interface CreateUserInput {
    name: string;
    email: string;
    authProvider: string;
    avatarUrl?: string;
    dietPreference?: string;
}

export interface UpdateUserInput {
    name?: string;
    email?: string;
    authProvider?: string;
    avatarUrl?: string;
    dietPreference?: string;
}

// Favorite input types
export interface CreateFavoriteInput {
    userId: string;
    recipeId: string;
    recipeName: string;
    recipeImage?: string;
    cuisine?: string;
}

export interface FavoriteQueryOptions {
    includeDeleted?: boolean;
    recipeId?: string;
}

/**
 * Output types for database operations
 */

// User output types
export interface UserWithFavorites extends User {
    favorites: Favorite[];
}

export interface UserQueryResult extends DatabaseResult<User> {}
export interface UsersQueryResult extends DatabaseResult<User[]> {}
export interface UserWithFavoritesResult
    extends DatabaseResult<UserWithFavorites> {}

// Favorite output types
export interface FavoriteQueryResult extends DatabaseResult<Favorite> {}
export interface FavoritesQueryResult extends DatabaseResult<Favorite[]> {}

/**
 * Repository method return types
 */
export interface CreateResult<T> extends DatabaseResult<T> {
    created: boolean;
}

export interface UpdateResult<T> extends DatabaseResult<T> {
    updated: boolean;
    previousData?: T;
}

export interface DeleteResult {
    success: boolean;
    deleted: boolean;
    error?: string;
}
