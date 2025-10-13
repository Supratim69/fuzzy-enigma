# 🛡️ Middleware Documentation

## 📋 Table of Contents

1. [Authentication Middleware](#authentication-middleware)
2. [Error Handling Middleware](#error-handling-middleware)
3. [CORS Middleware](#cors-middleware)
4. [Security Middleware](#security-middleware)
5. [Logging Middleware](#logging-middleware)
6. [Custom Middleware Examples](#custom-middleware-examples)

---

## 🔐 Authentication Middleware

### requireAuth (BetterAuth)

**File**: `src/middleware/auth.ts`

Protects routes requiring authentication using BetterAuth session validation.

```typescript
import type { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth.js";
import { logger } from "../config/logger.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
    };
    session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
    };
}

export const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const session = await auth.api.getSession({
            headers: req.headers as any,
        });

        if (!session) {
            return res.status(401).json({
                error: "unauthorized",
                message: "Authentication required",
            });
        }

        req.user = session.user;
        req.session = session.session;
        next();
    } catch (error) {
        logger.error({ error }, "Authentication error");
        return res.status(401).json({
            error: "unauthorized",
            message: "Invalid session",
        });
    }
};
```

**Usage:**

```typescript
import { requireAuth } from "../middleware/auth.js";

// Protect all routes in router
router.use(requireAuth);

// Protect specific route
router.get("/protected", requireAuth, (req, res) => {
    res.json({ user: req.user });
});
```

### optionalAuth (BetterAuth)

Adds user information if authenticated, continues without authentication if not.

```typescript
export const optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const session = await auth.api.getSession({
            headers: req.headers as any,
        });

        if (session) {
            req.user = session.user;
            req.session = session.session;
        }

        next();
    } catch (error) {
        logger.debug(
            { error },
            "Optional auth failed, continuing without user"
        );
        next();
    }
};
```

**Usage:**

```typescript
router.get("/public", optionalAuth, (req, res) => {
    if (req.user) {
        res.json({ message: `Hello ${req.user.name}` });
    } else {
        res.json({ message: "Hello guest" });
    }
});
```

---

## ❌ Error Handling Middleware

### Global Error Handler

**File**: `src/app.ts`

```typescript
app.use(
    (
        err: any,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
    ) => {
        logger.error({ err }, "Unhandled error");

        // Handle specific error types
        if (err.name === "ValidationError") {
            return res.status(400).json({
                error: "validation_error",
                message: err.message,
                details: err.details,
            });
        }

        if (err.name === "UnauthorizedError") {
            return res.status(401).json({
                error: "unauthorized",
                message: "Authentication required",
            });
        }

        if (err.code === "P2002") {
            // Prisma unique constraint violation
            return res.status(409).json({
                error: "conflict",
                message: "Resource already exists",
            });
        }

        if (err.code === "P2025") {
            // Prisma record not found
            return res.status(404).json({
                error: "not_found",
                message: "Resource not found",
            });
        }

        // Default error response
        res.status(err.status || 500).json({
            error: err.message || "internal_error",
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        });
    }
);
```

### 404 Handler

```typescript
app.use((_req, res) =>
    res.status(404).json({
        error: "not_found",
        message: "Endpoint not found",
    })
);
```

---

## 🌐 CORS Middleware

**File**: `src/app.ts`

```typescript
import cors from "cors";

const corsOptions = {
    origin: [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    credentials: true, // Important for cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
    ],
};

app.use(cors(corsOptions));
```

---

## 🔒 Security Middleware

### Helmet (Security Headers)

```typescript
import helmet from "helmet";

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);
```

### Rate Limiting Middleware

```typescript
import rateLimit from "express-rate-limit";

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: "too_many_requests",
        message: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth rate limiting (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    message: {
        error: "too_many_auth_attempts",
        message: "Too many authentication attempts, please try again later",
    },
});

app.use(generalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/manual-auth", authLimiter);
```

### Input Validation Middleware

```typescript
import { body, validationResult } from "express-validator";

export const validateSignUp = [
    body("name")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Name must be between 2 and 50 characters"),
    body("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email"),
    body("password")
        .isLength({ min: 8, max: 128 })
        .withMessage("Password must be between 8 and 128 characters")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage(
            "Password must contain at least one lowercase letter, one uppercase letter, and one number"
        ),
];

export const validateSignIn = [
    body("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
];

export const handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: "validation_error",
            message: "Invalid input data",
            details: errors.array(),
        });
    }
    next();
};

// Usage
router.post(
    "/sign-up",
    validateSignUp,
    handleValidationErrors,
    signUpController
);
```

---

## 📝 Logging Middleware

### Morgan HTTP Logging

**File**: `src/app.ts`

```typescript
import morgan from "morgan";
import { logger } from "./config/logger.js";

// Custom token for user ID
morgan.token("user-id", (req: any) => {
    return req.user?.id || "anonymous";
});

// Custom format
const morganFormat =
    ":remote-addr :user-id :method :url :status :res[content-length] - :response-time ms";

app.use(
    morgan(morganFormat, {
        stream: {
            write: (message: string) => {
                logger.info(message.trim());
            },
        },
        skip: (req, res) => {
            // Skip logging for health checks in production
            return (
                process.env.NODE_ENV === "production" && req.url === "/health"
            );
        },
    })
);
```

### Request ID Middleware

```typescript
import { v4 as uuidv4 } from "uuid";

export const requestId = (req: Request, res: Response, next: NextFunction) => {
    req.id = uuidv4();
    res.setHeader("X-Request-ID", req.id);
    next();
};

// Extend Request interface
declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}
```

---

## 🛠️ Custom Middleware Examples

### User Authorization Middleware

```typescript
export const requireOwnership = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    const { userId } = req.params;

    if (!req.user) {
        return res.status(401).json({
            error: "unauthorized",
            message: "Authentication required",
        });
    }

    if (req.user.id !== userId) {
        return res.status(403).json({
            error: "forbidden",
            message: "Access denied - you can only access your own resources",
        });
    }

    next();
};

// Usage
router.get(
    "/users/:userId/favorites",
    requireAuth,
    requireOwnership,
    getFavorites
);
```

### Admin Role Middleware

```typescript
export const requireAdmin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({
            error: "unauthorized",
            message: "Authentication required",
        });
    }

    // Check if user has admin role (you'd need to add role field to User model)
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { role: true },
    });

    if (user?.role !== "admin") {
        return res.status(403).json({
            error: "forbidden",
            message: "Admin access required",
        });
    }

    next();
};
```

### Content Type Validation

```typescript
export const requireJSON = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
    ) {
        if (!req.is("application/json")) {
            return res.status(400).json({
                error: "invalid_content_type",
                message: "Content-Type must be application/json",
            });
        }
    }
    next();
};
```

### Cache Control Middleware

```typescript
export const cacheControl = (maxAge: number = 3600) => {
    return (req: Request, res: Response, next: NextFunction) => {
        res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
        next();
    };
};

// Usage
router.get("/public-data", cacheControl(1800), getPublicData); // 30 minutes
```

### API Version Middleware

```typescript
export const apiVersion = (version: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const requestedVersion = req.headers["api-version"] || "v1";

        if (requestedVersion !== version) {
            return res.status(400).json({
                error: "unsupported_api_version",
                message: `API version ${requestedVersion} is not supported. Use ${version}`,
            });
        }

        next();
    };
};

// Usage
router.use("/api/v1", apiVersion("v1"));
```

### Request Size Limiting

```typescript
import { Request, Response, NextFunction } from "express";

export const limitRequestSize = (maxSize: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const contentLength = parseInt(req.headers["content-length"] || "0");

        if (contentLength > maxSize) {
            return res.status(413).json({
                error: "payload_too_large",
                message: `Request size exceeds limit of ${maxSize} bytes`,
            });
        }

        next();
    };
};

// Usage
router.post("/upload", limitRequestSize(10 * 1024 * 1024), uploadHandler); // 10MB limit
```

---

## 🔧 Middleware Configuration

### Middleware Order (Important!)

```typescript
// 1. Security middleware (first)
app.use(helmet());
app.use(cors(corsOptions));

// 2. Request parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 3. Logging
app.use(requestId);
app.use(morgan(...));

// 4. Rate limiting
app.use(generalLimiter);

// 5. Compression
app.use(compression());

// 6. Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api", requireAuth, protectedRouter);

// 7. Error handling (last)
app.use(notFoundHandler);
app.use(errorHandler);
```

### Environment-Specific Middleware

```typescript
// Development only
if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`, req.body);
        next();
    });
}

// Production only
if (process.env.NODE_ENV === "production") {
    app.use(helmet());
    app.use(rateLimiter);
}
```

This comprehensive middleware documentation covers all authentication, security, and utility middleware used in your application!
