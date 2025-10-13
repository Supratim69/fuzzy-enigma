# 📚 Complete API Documentation

## 🔐 Authentication System Overview

This backend provides a complete authentication system using BetterAuth with PostgreSQL, featuring email/password authentication, session management, and route protection.

## 🌐 Base URL

```
Development: http://localhost:4000
Production: [Your production URL]
```

## 📋 Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [User Management Endpoints](#user-management-endpoints)
3. [Protected Routes](#protected-routes)
4. [Database Models](#database-models)
5. [Middleware](#middleware)
6. [Error Handling](#error-handling)
7. [Frontend Integration](#frontend-integration)

---

## 🔐 Authentication Endpoints

### BetterAuth Endpoints (Recommended)

#### Sign Up

```http
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "image": "https://example.com/avatar.jpg" // optional
}
```

**Response (201):**

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

#### Sign In

```http
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123",
  "rememberMe": true // optional, default: true
}
```

**Response (200):**

```json
{
    "user": {
        "id": "cm123...",
        "name": "John Doe",
        "email": "john@example.com",
        "emailVerified": false
    },
    "session": {
        "id": "cm456...",
        "expiresAt": "2024-01-08T00:00:00.000Z"
    }
}
```

#### Sign Out

```http
POST /api/auth/sign-out
Cookie: [session cookies]
```

**Response (200):**

```json
{
    "success": true
}
```

#### Get Current Session

```http
GET /api/auth/session
Cookie: [session cookies]
```

**Response (200):**

```json
{
    "user": {
        "id": "cm123...",
        "name": "John Doe",
        "email": "john@example.com",
        "emailVerified": false
    },
    "session": {
        "id": "cm456...",
        "expiresAt": "2024-01-08T00:00:00.000Z"
    }
}
```

#### Change Password

```http
POST /api/auth/change-password
Content-Type: application/json
Cookie: [session cookies]

{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123",
  "revokeOtherSessions": true // optional
}
```

#### Request Password Reset

```http
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "john@example.com",
  "redirectTo": "https://yourapp.com/reset-password"
}
```

#### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "newpassword123"
}
```

### Manual Auth Endpoints (Alternative)

#### Manual Sign Up

```http
POST /api/manual-auth/sign-up
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```

#### Manual Sign In

```http
POST /api/manual-auth/sign-in
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "password123",
  "rememberMe": true
}
```

#### Manual Sign Out

```http
POST /api/manual-auth/sign-out
Cookie: [auth-token]
```

#### Manual Get Session

```http
GET /api/manual-auth/session
Cookie: [auth-token]
```

---

## 👤 User Management Endpoints

### Get User Profile

```http
GET /api/auth/profile
Cookie: [session cookies]
```

**Response (200):**

```json
{
    "user": {
        "id": "cm123...",
        "name": "John Doe",
        "email": "john@example.com",
        "emailVerified": false,
        "image": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "dietPreference": "vegetarian"
    },
    "session": {
        "id": "cm456...",
        "expiresAt": "2024-01-08T00:00:00.000Z"
    }
}
```

### Update User Profile

```http
PUT /api/auth/profile
Content-Type: application/json
Cookie: [session cookies]

{
  "name": "John Smith",
  "dietPreference": "vegan"
}
```

### Get User Sessions

```http
GET /api/auth/sessions
Cookie: [session cookies]
```

**Response (200):**

```json
{
    "sessions": [
        {
            "id": "cm456...",
            "expiresAt": "2024-01-08T00:00:00.000Z",
            "ipAddress": "192.168.1.1",
            "userAgent": "Mozilla/5.0...",
            "createdAt": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

### Revoke Specific Session

```http
DELETE /api/auth/sessions/:sessionId
Cookie: [session cookies]
```

### Revoke All Other Sessions

```http
DELETE /api/auth/sessions
Cookie: [session cookies]
```

---

## 🔒 Protected Routes

All routes requiring authentication use the `requireAuth` middleware.

### Favorites API (Protected)

#### Get User Favorites

```http
GET /api/users/:userId/favorites
Cookie: [session cookies]
```

**Response (200):**

```json
{
    "favorites": [
        {
            "id": "cm789...",
            "recipeId": "recipe123",
            "recipeName": "Chocolate Cake",
            "recipeImage": "https://example.com/cake.jpg",
            "cuisine": "Dessert",
            "dateSaved": "2024-01-01T00:00:00.000Z"
        }
    ],
    "total": 1
}
```

#### Add to Favorites

```http
POST /api/users/:userId/favorites
Content-Type: application/json
Cookie: [session cookies]

{
  "recipeId": "recipe123",
  "recipeName": "Chocolate Cake",
  "recipeImage": "https://example.com/cake.jpg",
  "cuisine": "Dessert"
}
```

#### Remove from Favorites

```http
DELETE /api/users/:userId/favorites/:recipeId
Cookie: [session cookies]
```

#### Get Favorites Count

```http
GET /api/users/:userId/favorites/count
Cookie: [session cookies]
```

#### Check Favorite Status

```http
GET /api/users/:userId/favorites/:recipeId/status
Cookie: [session cookies]
```

#### Toggle Favorite

```http
POST /api/users/:userId/favorites/:recipeId/toggle
Cookie: [session cookies]
```

#### Batch Add Favorites

```http
POST /api/users/:userId/favorites/batch
Content-Type: application/json
Cookie: [session cookies]

{
  "recipes": [
    {
      "recipeId": "recipe123",
      "recipeName": "Chocolate Cake",
      "recipeImage": "https://example.com/cake.jpg",
      "cuisine": "Dessert"
    }
  ]
}
```

---

## 🗄️ Database Models

### User Model

```typescript
interface User {
    id: string; // CUID
    name: string;
    email: string; // Unique
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;

    // Legacy fields (backward compatibility)
    authProvider?: string | null;
    avatarUrl?: string | null;
    dietPreference?: string | null;

    // Relations
    favorites: Favorite[];
    accounts: Account[];
    sessions: Session[];
}
```

### Account Model

```typescript
interface Account {
    id: string; // CUID
    accountId: string; // Email for credential provider
    providerId: string; // "credential" for email/password
    userId: string; // Foreign key to User
    accessToken?: string | null;
    refreshToken?: string | null;
    idToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    refreshTokenExpiresAt?: Date | null;
    scope?: string | null;
    password?: string | null; // Hashed password
    createdAt: Date;
    updatedAt: Date;
}
```

### Session Model

```typescript
interface Session {
    id: string; // CUID
    expiresAt: Date;
    token: string; // Unique session token
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
    userId: string; // Foreign key to User
}
```

### Favorite Model

```typescript
interface Favorite {
    id: string; // CUID
    userId: string; // Foreign key to User
    recipeId: string;
    recipeName: string;
    recipeImage?: string | null;
    cuisine?: string | null;
    dateSaved: Date;
    deletedAt?: Date | null; // Soft delete
}
```

### Verification Model

```typescript
interface Verification {
    id: string; // CUID
    identifier: string; // Email or phone
    value: string; // Verification code/token
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
```

---

## 🛡️ Middleware

### requireAuth

Protects routes requiring authentication.

```typescript
import { requireAuth } from "../middleware/auth.js";

// Protect all routes in router
router.use(requireAuth);

// Protect specific route
router.get("/protected", requireAuth, (req, res) => {
    // req.user and req.session are available
    res.json({ user: req.user });
});
```

**Request Extensions:**

```typescript
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null;
        createdAt: Date;
        updatedAt: Date;
    };
    session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null;
        userAgent?: string | null;
    };
}
```

### optionalAuth

Adds user info if authenticated, continues if not.

```typescript
import { optionalAuth } from "../middleware/auth.js";

router.get("/public", optionalAuth, (req, res) => {
    if (req.user) {
        // User is authenticated
        res.json({ message: `Hello ${req.user.name}` });
    } else {
        // User is not authenticated
        res.json({ message: "Hello guest" });
    }
});
```

---

## ❌ Error Handling

### Common Error Responses

#### 400 Bad Request

```json
{
    "error": "validation_error",
    "message": "Email and password are required"
}
```

#### 401 Unauthorized

```json
{
    "error": "unauthorized",
    "message": "Authentication required"
}
```

#### 403 Forbidden

```json
{
    "error": "forbidden",
    "message": "Access denied"
}
```

#### 404 Not Found

```json
{
    "error": "not_found",
    "message": "Resource not found"
}
```

#### 409 Conflict

```json
{
    "error": "conflict",
    "message": "User with this email already exists"
}
```

#### 422 Unprocessable Entity

```json
{
    "error": "validation_error",
    "message": "Password must be at least 8 characters long"
}
```

#### 500 Internal Server Error

```json
{
    "error": "internal_error",
    "message": "Something went wrong"
}
```

---

## 🌐 Frontend Integration

### BetterAuth Client (Recommended)

#### Installation

```bash
npm install better-auth
```

#### Setup

```typescript
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
    baseURL: "http://localhost:4000", // Your backend URL
});
```

#### Usage Examples

```typescript
// Sign up
const { data, error } = await authClient.signUp.email({
    name: "John Doe",
    email: "john@example.com",
    password: "password123",
});

// Sign in
const { data, error } = await authClient.signIn.email({
    email: "john@example.com",
    password: "password123",
    rememberMe: true,
});

// Get session
const session = await authClient.getSession();

// Sign out
await authClient.signOut();

// Change password
const { data, error } = await authClient.changePassword({
    currentPassword: "oldpass",
    newPassword: "newpass",
    revokeOtherSessions: true,
});
```

### Making Authenticated Requests

#### With BetterAuth Client

```typescript
// BetterAuth automatically handles cookies
const response = await fetch("/api/users/123/favorites", {
    credentials: "include", // Important!
});
```

#### With Manual Fetch

```typescript
// For manual auth endpoints
const response = await fetch("/api/manual-auth/session", {
    credentials: "include",
});

if (response.ok) {
    const { user } = await response.json();
    console.log("Authenticated user:", user);
}
```

### React Integration Example

```typescript
import { createAuthClient } from "better-auth/client";
import { createContext, useContext, useEffect, useState } from "react";

const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
});

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (name: string, email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const session = await authClient.getSession();
            setUser(session?.user || null);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, password: string) => {
        const { data, error } = await authClient.signIn.email({
            email,
            password,
            rememberMe: true,
        });

        if (error) throw error;
        setUser(data.user);
    };

    const signUp = async (name: string, email: string, password: string) => {
        const { data, error } = await authClient.signUp.email({
            name,
            email,
            password,
        });

        if (error) throw error;
        setUser(data.user);
    };

    const signOut = async () => {
        await authClient.signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{ user, loading, signIn, signUp, signOut }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
```

---

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# BetterAuth
BETTER_AUTH_SECRET="your-super-secret-key-min-32-chars"
CLIENT_URL="http://localhost:3000"
SERVER_URL="http://localhost:4000"

# App
PORT=4000
NODE_ENV=development
```

### Security Best Practices

1. **Use HTTPS in production**
2. **Set strong BETTER_AUTH_SECRET** (min 32 characters)
3. **Configure CORS properly** for your domain
4. **Use secure cookies** (automatic in production)
5. **Implement rate limiting** for auth endpoints
6. **Validate input data** on all endpoints
7. **Use environment variables** for sensitive data

---

## 🚀 Deployment

### Production Checklist

-   [ ] Set `NODE_ENV=production`
-   [ ] Use strong `BETTER_AUTH_SECRET`
-   [ ] Configure production database URL
-   [ ] Set correct `CLIENT_URL` and `SERVER_URL`
-   [ ] Enable HTTPS
-   [ ] Configure CORS for production domain
-   [ ] Set up database backups
-   [ ] Monitor error logs
-   [ ] Implement rate limiting
-   [ ] Set up health checks

This documentation provides everything needed for seamless integration with your authentication system!
