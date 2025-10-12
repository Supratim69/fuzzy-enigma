import { Prisma } from "@prisma/client";
import { prisma } from "../database/client.js";
import type {
    User,
    CreateUserInput,
    UpdateUserInput,
    UserQueryResult,
    UsersQueryResult,
    CreateResult,
    UpdateResult,
    DeleteResult,
} from "../types/database.js";

export class UserRepository {
    async create(userData: CreateUserInput): Promise<CreateResult<User>> {
        try {
            // Validate required fields
            if (!userData.name?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "Name is required and cannot be empty",
                };
            }

            if (!userData.email?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "Email is required and cannot be empty",
                };
            }

            if (!userData.authProvider?.trim()) {
                return {
                    success: false,
                    created: false,
                    error: "Auth provider is required and cannot be empty",
                };
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                return {
                    success: false,
                    created: false,
                    error: "Invalid email format",
                };
            }

            const user = await prisma.user.create({
                data: {
                    name: userData.name.trim(),
                    email: userData.email.toLowerCase().trim(),
                    authProvider: userData.authProvider.trim(),
                    avatarUrl: userData.avatarUrl?.trim() || null,
                    dietPreference: userData.dietPreference?.trim() || null,
                },
            });

            return {
                success: true,
                created: true,
                data: user,
            };
        } catch (error) {
            // Handle unique constraint violation for email
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    return {
                        success: false,
                        created: false,
                        error: "Email already exists",
                    };
                }
            }

            return {
                success: false,
                created: false,
                error: `Failed to create user: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Find user by ID
     * @param id - User ID to search for
     * @returns Promise with user data or null if not found
     */
    async findById(id: string): Promise<UserQueryResult> {
        try {
            if (!id?.trim()) {
                return {
                    success: false,
                    error: "User ID is required",
                };
            }

            const user = await prisma.user.findUnique({
                where: { id: id.trim() },
            });

            if (!user) {
                return {
                    success: false,
                    error: "User not found",
                };
            }

            return {
                success: true,
                data: user,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to find user: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Find user by email address
     * @param email - Email address to search for
     * @returns Promise with user data or null if not found
     */
    async findByEmail(email: string): Promise<UserQueryResult> {
        try {
            if (!email?.trim()) {
                return {
                    success: false,
                    error: "Email is required",
                };
            }

            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase().trim() },
            });

            if (!user) {
                return {
                    success: false,
                    error: "User not found",
                };
            }

            return {
                success: true,
                data: user,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to find user: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Update user data
     * @param id - User ID to update
     * @param userData - Updated user data
     * @returns Promise with update result
     */
    async update(
        id: string,
        userData: UpdateUserInput
    ): Promise<UpdateResult<User>> {
        try {
            if (!id?.trim()) {
                return {
                    success: false,
                    updated: false,
                    error: "User ID is required",
                };
            }

            // Get current user data for comparison
            const existingUser = await prisma.user.findUnique({
                where: { id: id.trim() },
            });

            if (!existingUser) {
                return {
                    success: false,
                    updated: false,
                    error: "User not found",
                };
            }

            // Validate email format if provided
            if (userData.email && !userData.email.trim()) {
                return {
                    success: false,
                    updated: false,
                    error: "Email cannot be empty",
                };
            }

            if (userData.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(userData.email)) {
                    return {
                        success: false,
                        updated: false,
                        error: "Invalid email format",
                    };
                }
            }

            // Prepare update data, only including defined fields
            const updateData: Prisma.UserUpdateInput = {};

            if (userData.name !== undefined) {
                if (!userData.name.trim()) {
                    return {
                        success: false,
                        updated: false,
                        error: "Name cannot be empty",
                    };
                }
                updateData.name = userData.name.trim();
            }

            if (userData.email !== undefined) {
                updateData.email = userData.email.toLowerCase().trim();
            }

            if (userData.authProvider !== undefined) {
                if (!userData.authProvider.trim()) {
                    return {
                        success: false,
                        updated: false,
                        error: "Auth provider cannot be empty",
                    };
                }
                updateData.authProvider = userData.authProvider.trim();
            }

            if (userData.avatarUrl !== undefined) {
                updateData.avatarUrl = userData.avatarUrl?.trim() || null;
            }

            if (userData.dietPreference !== undefined) {
                updateData.dietPreference =
                    userData.dietPreference?.trim() || null;
            }

            const updatedUser = await prisma.user.update({
                where: { id: id.trim() },
                data: updateData,
            });

            return {
                success: true,
                updated: true,
                data: updatedUser,
                previousData: existingUser,
            };
        } catch (error) {
            // Handle unique constraint violation for email
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    return {
                        success: false,
                        updated: false,
                        error: "Email already exists",
                    };
                }
                if (error.code === "P2025") {
                    return {
                        success: false,
                        updated: false,
                        error: "User not found",
                    };
                }
            }

            return {
                success: false,
                updated: false,
                error: `Failed to update user: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Delete user (hard delete)
     * @param id - User ID to delete
     * @returns Promise with deletion result
     */
    async delete(id: string): Promise<DeleteResult> {
        try {
            if (!id?.trim()) {
                return {
                    success: false,
                    deleted: false,
                    error: "User ID is required",
                };
            }

            await prisma.user.delete({
                where: { id: id.trim() },
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
                        error: "User not found",
                    };
                }
            }

            return {
                success: false,
                deleted: false,
                error: `Failed to delete user: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Find all users (with optional pagination)
     * @param options - Query options including pagination
     * @returns Promise with users array
     */
    async findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<UsersQueryResult> {
        try {
            const queryOptions: any = {
                orderBy: { createdAt: "desc" },
            };

            if (options?.limit !== undefined) {
                queryOptions.take = options.limit;
            }

            if (options?.offset !== undefined) {
                queryOptions.skip = options.offset;
            }

            const users = await prisma.user.findMany(queryOptions);

            return {
                success: true,
                data: users,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to fetch users: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    /**
     * Check if email exists
     * @param email - Email to check
     * @returns Promise with boolean result
     */
    async emailExists(email: string): Promise<boolean> {
        try {
            if (!email?.trim()) {
                return false;
            }

            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase().trim() },
                select: { id: true },
            });

            return Boolean(user);
        } catch (error) {
            return false;
        }
    }
}

// Export singleton instance
export const userRepository = new UserRepository();
export default userRepository;
