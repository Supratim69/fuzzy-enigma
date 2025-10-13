# 🎮 Controllers & Repository Documentation

## 📋 Table of Contents

1. [Auth Controllers](#auth-controllers)
2. [Favorites Controller](#favorites-controller)
3. [Users Controller](#users-controller)
4. [Repository Patterns](#repository-patterns)
5. [Service Layer](#service-layer)

---

## 🔐 Auth Controllers

### authController.ts

#### getProfile

**Purpose**: Get current authenticated user's profile  
**Route**: `GET /api/auth/profile`  
**Middleware**: `requireAuth`

```typescript
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
    // Returns user profile and session info
    // Uses BetterAuth session validation
};
```

**Request**: Authenticated request with cookies  
**Response**:

```json
{
    "user": {
        "id": "cm123...",
        "name": "John Doe",
        "email": "john@example.com",
        "emailVerified": false,
        "image": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "session": {
        "id": "cm456...",
        "expiresAt": "2024-01-08T00:00:00.000Z"
    }
}
```

#### updateProfile

**Purpose**: Update user profile information  
**Route**: `PUT /api/auth/profile`  
**Middleware**: `requireAuth`

```typescript
export const updateProfile = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { name, dietPreference } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
    }

    // Update using BetterAuth API
    const updatedUser = await auth.api.updateUser({
        body: { name: name.trim() },
        headers: req.headers as any,
    });
};
```

**Request Body**:

```json
{
    "name": "John Smith",
    "dietPreference": "vegetarian"
}
```

#### getSessions

**Purpose**: Get all active sessions for current user  
**Route**: `GET /api/auth/sessions`  
**Middleware**: `requireAuth`

```typescript
export const getSessions = async (req: AuthenticatedRequest, res: Response) => {
    const sessions = await auth.api.listSessions({
        headers: req.headers as any,
    });
};
```

#### revokeSession

**Purpose**: Revoke a specific session  
**Route**: `DELETE /api/auth/sessions/:sessionId`  
**Middleware**: `requireAuth`

```typescript
export const revokeSession = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { sessionId } = req.params;

    await auth.api.revokeSession({
        body: { token: sessionId },
        headers: req.headers as any,
    });
};
```

#### revokeOtherSessions

**Purpose**: Revoke all sessions except current one  
**Route**: `DELETE /api/auth/sessions`  
**Middleware**: `requireAuth`

```typescript
export const revokeOtherSessions = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    await auth.api.revokeOtherSessions({
        headers: req.headers as any,
    });
};
```

---

## ❤️ Favorites Controller

### favoritesController.ts

Manages user's favorite recipes with full CRUD operations.

#### getUserFavorites

**Purpose**: Get all favorites for a user with pagination  
**Route**: `GET /api/users/:userId/favorites`  
**Middleware**: `requireAuth`

```typescript
export const getUserFavorites = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId } = req.params;
    const { page = 1, limit = 20, cuisine, search } = req.query;

    // Authorization check
    if (req.user?.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const whereClause = {
        userId,
        deletedAt: null,
        ...(cuisine && { cuisine }),
        ...(search && {
            OR: [
                { recipeName: { contains: search, mode: "insensitive" } },
                { cuisine: { contains: search, mode: "insensitive" } },
            ],
        }),
    };

    const [favorites, total] = await Promise.all([
        prisma.favorite.findMany({
            where: whereClause,
            orderBy: { dateSaved: "desc" },
            skip,
            take: Number(limit),
        }),
        prisma.favorite.count({ where: whereClause }),
    ]);

    res.json({
        favorites,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
        },
    });
};
```

**Query Parameters**:

-   `page`: Page number (default: 1)
-   `limit`: Items per page (default: 20)
-   `cuisine`: Filter by cuisine type
-   `search`: Search in recipe name or cuisine

#### addFavorite

**Purpose**: Add recipe to user's favorites  
**Route**: `POST /api/users/:userId/favorites`  
**Middleware**: `requireAuth`

```typescript
export const addFavorite = async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { recipeId, recipeName, recipeImage, cuisine } = req.body;

    // Authorization check
    if (req.user?.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
    }

    // Validation
    if (!recipeId || !recipeName) {
        return res.status(400).json({
            error: "recipeId and recipeName are required",
        });
    }

    // Check if already favorited (including soft-deleted)
    const existing = await prisma.favorite.findFirst({
        where: { userId, recipeId },
    });

    if (existing) {
        if (existing.deletedAt) {
            // Restore soft-deleted favorite
            const restored = await prisma.favorite.update({
                where: { id: existing.id },
                data: {
                    deletedAt: null,
                    dateSaved: new Date(),
                    recipeName,
                    recipeImage,
                    cuisine,
                },
            });
            return res.json(restored);
        } else {
            return res.status(409).json({
                error: "Recipe already in favorites",
            });
        }
    }

    // Create new favorite
    const favorite = await prisma.favorite.create({
        data: {
            userId,
            recipeId,
            recipeName,
            recipeImage,
            cuisine,
        },
    });

    res.status(201).json(favorite);
};
```

#### removeFavorite

**Purpose**: Remove recipe from favorites (soft delete)  
**Route**: `DELETE /api/users/:userId/favorites/:recipeId`  
**Middleware**: `requireAuth`

```typescript
export const removeFavorite = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId, recipeId } = req.params;

    // Authorization check
    if (req.user?.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
    }

    const favorite = await prisma.favorite.findFirst({
        where: {
            userId,
            recipeId,
            deletedAt: null,
        },
    });

    if (!favorite) {
        return res.status(404).json({
            error: "Favorite not found",
        });
    }

    // Soft delete
    await prisma.favorite.update({
        where: { id: favorite.id },
        data: { deletedAt: new Date() },
    });

    res.json({ success: true });
};
```

#### getFavoriteStatus

**Purpose**: Check if recipe is favorited  
**Route**: `GET /api/users/:userId/favorites/:recipeId/status`  
**Middleware**: `requireAuth`

```typescript
export const getFavoriteStatus = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId, recipeId } = req.params;

    const favorite = await prisma.favorite.findFirst({
        where: {
            userId,
            recipeId,
            deletedAt: null,
        },
    });

    res.json({
        isFavorited: !!favorite,
        favorite: favorite || null,
    });
};
```

#### toggleFavorite

**Purpose**: Toggle favorite status (add/remove)  
**Route**: `POST /api/users/:userId/favorites/:recipeId/toggle`  
**Middleware**: `requireAuth`

```typescript
export const toggleFavorite = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId, recipeId } = req.params;
    const { recipeName, recipeImage, cuisine } = req.body;

    const existing = await prisma.favorite.findFirst({
        where: { userId, recipeId },
    });

    if (existing && !existing.deletedAt) {
        // Remove from favorites
        await prisma.favorite.update({
            where: { id: existing.id },
            data: { deletedAt: new Date() },
        });

        res.json({
            action: "removed",
            isFavorited: false,
        });
    } else {
        // Add to favorites or restore
        const favorite = existing
            ? await prisma.favorite.update({
                  where: { id: existing.id },
                  data: {
                      deletedAt: null,
                      dateSaved: new Date(),
                      recipeName,
                      recipeImage,
                      cuisine,
                  },
              })
            : await prisma.favorite.create({
                  data: {
                      userId,
                      recipeId,
                      recipeName,
                      recipeImage,
                      cuisine,
                  },
              });

        res.json({
            action: "added",
            isFavorited: true,
            favorite,
        });
    }
};
```

#### batchAddFavorites

**Purpose**: Add multiple recipes to favorites  
**Route**: `POST /api/users/:userId/favorites/batch`  
**Middleware**: `requireAuth`

```typescript
export const batchAddFavorites = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId } = req.params;
    const { recipes } = req.body;

    if (!Array.isArray(recipes) || recipes.length === 0) {
        return res.status(400).json({
            error: "recipes array is required",
        });
    }

    const results = await prisma.$transaction(async (tx) => {
        const created = [];
        const errors = [];

        for (const recipe of recipes) {
            try {
                const { recipeId, recipeName, recipeImage, cuisine } = recipe;

                if (!recipeId || !recipeName) {
                    errors.push({
                        recipe,
                        error: "recipeId and recipeName are required",
                    });
                    continue;
                }

                // Check existing
                const existing = await tx.favorite.findFirst({
                    where: { userId, recipeId },
                });

                if (existing && !existing.deletedAt) {
                    errors.push({
                        recipe,
                        error: "Already in favorites",
                    });
                    continue;
                }

                const favorite = existing
                    ? await tx.favorite.update({
                          where: { id: existing.id },
                          data: {
                              deletedAt: null,
                              dateSaved: new Date(),
                              recipeName,
                              recipeImage,
                              cuisine,
                          },
                      })
                    : await tx.favorite.create({
                          data: {
                              userId,
                              recipeId,
                              recipeName,
                              recipeImage,
                              cuisine,
                          },
                      });

                created.push(favorite);
            } catch (error) {
                errors.push({ recipe, error: error.message });
            }
        }

        return { created, errors };
    });

    res.json(results);
};
```

#### getFavoritesCount

**Purpose**: Get total count of user's favorites  
**Route**: `GET /api/users/:userId/favorites/count`  
**Middleware**: `requireAuth`

```typescript
export const getFavoritesCount = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId } = req.params;

    const count = await prisma.favorite.count({
        where: {
            userId,
            deletedAt: null,
        },
    });

    res.json({ count });
};
```

---

## 👥 Users Controller

### usersController.ts

Manages user-related operations beyond authentication.

#### getUserById

**Purpose**: Get user profile by ID  
**Route**: `GET /api/users/:userId`  
**Middleware**: `optionalAuth`

```typescript
export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: req.user?.id === userId, // Only show email to self
            image: true,
            createdAt: true,
            dietPreference: true,
        },
    });

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
};
```

#### updateUserPreferences

**Purpose**: Update user preferences  
**Route**: `PUT /api/users/:userId/preferences`  
**Middleware**: `requireAuth`

```typescript
export const updateUserPreferences = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    const { userId } = req.params;
    const { dietPreference, avatarUrl } = req.body;

    // Authorization check
    if (req.user?.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            dietPreference,
            avatarUrl,
            updatedAt: new Date(),
        },
    });

    res.json({ user: updatedUser });
};
```

---

## 🏗️ Repository Patterns

### UserRepository

```typescript
class UserRepository {
    async findById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            include: {
                accounts: true,
                sessions: true,
            },
        });
    }

    async findByEmail(email: string) {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    async create(userData: CreateUserData) {
        return prisma.user.create({
            data: userData,
        });
    }

    async update(id: string, userData: UpdateUserData) {
        return prisma.user.update({
            where: { id },
            data: userData,
        });
    }

    async delete(id: string) {
        return prisma.user.delete({
            where: { id },
        });
    }
}
```

### FavoritesRepository

```typescript
class FavoritesRepository {
    async findByUserId(userId: string, options: FindOptions = {}) {
        const { page = 1, limit = 20, cuisine, search } = options;

        return prisma.favorite.findMany({
            where: {
                userId,
                deletedAt: null,
                ...(cuisine && { cuisine }),
                ...(search && {
                    OR: [
                        {
                            recipeName: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        { cuisine: { contains: search, mode: "insensitive" } },
                    ],
                }),
            },
            orderBy: { dateSaved: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });
    }

    async findByUserAndRecipe(userId: string, recipeId: string) {
        return prisma.favorite.findFirst({
            where: { userId, recipeId },
        });
    }

    async create(favoriteData: CreateFavoriteData) {
        return prisma.favorite.create({
            data: favoriteData,
        });
    }

    async softDelete(id: string) {
        return prisma.favorite.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async restore(id: string) {
        return prisma.favorite.update({
            where: { id },
            data: {
                deletedAt: null,
                dateSaved: new Date(),
            },
        });
    }

    async countByUserId(userId: string) {
        return prisma.favorite.count({
            where: {
                userId,
                deletedAt: null,
            },
        });
    }
}
```

---

## 🔧 Service Layer

### AuthService

```typescript
class AuthService {
    async validateUser(email: string, password: string) {
        const user = await userRepository.findByEmail(email);
        if (!user) return null;

        const account = await prisma.account.findFirst({
            where: {
                userId: user.id,
                providerId: "credential",
            },
        });

        if (!account?.password) return null;

        const isValid = await bcrypt.compare(password, account.password);
        return isValid ? user : null;
    }

    async createUser(userData: CreateUserData) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        return prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: userData.name,
                    email: userData.email,
                    emailVerified: false,
                },
            });

            await tx.account.create({
                data: {
                    accountId: userData.email,
                    providerId: "credential",
                    userId: user.id,
                    password: hashedPassword,
                },
            });

            return user;
        });
    }

    async createSession(userId: string, options: SessionOptions = {}) {
        const token = jwt.sign({ userId }, process.env.BETTER_AUTH_SECRET!, {
            expiresIn: options.expiresIn || "7d",
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (options.days || 7));

        return prisma.session.create({
            data: {
                token,
                userId,
                expiresAt,
                ipAddress: options.ipAddress,
                userAgent: options.userAgent,
            },
        });
    }
}
```

### FavoritesService

```typescript
class FavoritesService {
    async addToFavorites(userId: string, recipeData: RecipeData) {
        const existing = await favoritesRepository.findByUserAndRecipe(
            userId,
            recipeData.recipeId
        );

        if (existing) {
            if (existing.deletedAt) {
                return favoritesRepository.restore(existing.id);
            } else {
                throw new Error("Recipe already in favorites");
            }
        }

        return favoritesRepository.create({
            userId,
            ...recipeData,
        });
    }

    async removeFromFavorites(userId: string, recipeId: string) {
        const favorite = await favoritesRepository.findByUserAndRecipe(
            userId,
            recipeId
        );

        if (!favorite || favorite.deletedAt) {
            throw new Error("Favorite not found");
        }

        return favoritesRepository.softDelete(favorite.id);
    }

    async toggleFavorite(userId: string, recipeData: RecipeData) {
        const existing = await favoritesRepository.findByUserAndRecipe(
            userId,
            recipeData.recipeId
        );

        if (existing && !existing.deletedAt) {
            await favoritesRepository.softDelete(existing.id);
            return { action: "removed", isFavorited: false };
        } else {
            const favorite = existing
                ? await favoritesRepository.restore(existing.id)
                : await favoritesRepository.create({ userId, ...recipeData });

            return {
                action: "added",
                isFavorited: true,
                favorite,
            };
        }
    }
}
```

This comprehensive documentation covers all controllers, repository patterns, and service layers for easy integration and maintenance!
