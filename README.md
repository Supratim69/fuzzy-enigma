# 🍳 Recipe Backend with Authentication

A robust Express.js backend with PostgreSQL and BetterAuth authentication system for a recipe application.

## 🚀 Features

-   **🔐 Complete Authentication System** - Email/password auth with BetterAuth
-   **📊 PostgreSQL Database** - Reliable data storage with Prisma ORM
-   **❤️ Favorites Management** - Users can save and manage favorite recipes
-   **🛡️ Route Protection** - Secure endpoints with middleware
-   **🔄 Session Management** - JWT tokens and secure cookies
-   **📝 Comprehensive API** - RESTful endpoints with full documentation
-   **🧪 Testing Suite** - Automated tests for all functionality
-   **📚 Full Documentation** - Complete API and development docs

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [API Documentation](#api-documentation)
5. [Database Schema](#database-schema)
6. [Authentication](#authentication)
7. [Development](#development)
8. [Deployment](#deployment)
9. [Contributing](#contributing)

## ⚡ Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd fuzzy-enigma-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npm run db:push
npm run db:generate

# Start development server
npm run dev
```

The server will start on `http://localhost:4000`

## 🛠️ Installation

### Prerequisites

-   Node.js 18+
-   PostgreSQL database
-   npm or yarn

### Dependencies

```bash
# Core dependencies
npm install express prisma @prisma/client better-auth bcrypt jsonwebtoken

# Development dependencies
npm install -D typescript tsx @types/node @types/express @types/bcrypt @types/jsonwebtoken

# Security & utilities
npm install helmet cors compression morgan dotenv pino
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
BETTER_AUTH_SECRET="your-super-secret-key-min-32-characters"
CLIENT_URL="http://localhost:3000"
SERVER_URL="http://localhost:4000"

# External APIs (optional)
PINECONE_API_KEY="your-pinecone-key"
GEMINI_API_KEY="your-gemini-key"
S3_BUCKET="your-s3-bucket"
S3_ACCESS_KEY="your-s3-access-key"
S3_SECRET_KEY="your-s3-secret-key"
```

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations (for production)
npm run db:migrate
```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint                    | Description                 | Auth Required |
| ------ | --------------------------- | --------------------------- | ------------- |
| POST   | `/api/auth/sign-up/email`   | Sign up with email/password | No            |
| POST   | `/api/auth/sign-in/email`   | Sign in with email/password | No            |
| POST   | `/api/auth/sign-out`        | Sign out current session    | Yes           |
| GET    | `/api/auth/profile`         | Get current user profile    | Yes           |
| PUT    | `/api/auth/profile`         | Update user profile         | Yes           |
| POST   | `/api/auth/change-password` | Change password             | Yes           |
| GET    | `/api/auth/sessions`        | Get all user sessions       | Yes           |
| DELETE | `/api/auth/sessions/:id`    | Revoke specific session     | Yes           |

### Favorites Endpoints

| Method | Endpoint                                        | Description             | Auth Required |
| ------ | ----------------------------------------------- | ----------------------- | ------------- |
| GET    | `/api/users/:userId/favorites`                  | Get user's favorites    | Yes           |
| POST   | `/api/users/:userId/favorites`                  | Add recipe to favorites | Yes           |
| DELETE | `/api/users/:userId/favorites/:recipeId`        | Remove from favorites   | Yes           |
| GET    | `/api/users/:userId/favorites/:recipeId/status` | Check favorite status   | Yes           |
| POST   | `/api/users/:userId/favorites/:recipeId/toggle` | Toggle favorite status  | Yes           |
| GET    | `/api/users/:userId/favorites/count`            | Get favorites count     | Yes           |
| POST   | `/api/users/:userId/favorites/batch`            | Batch add favorites     | Yes           |

### Example Requests

#### Sign Up

```bash
curl -X POST http://localhost:4000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Sign In

```bash
curl -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Add Favorite

```bash
curl -X POST http://localhost:4000/api/users/USER_ID/favorites \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "recipeId": "recipe123",
    "recipeName": "Chocolate Cake",
    "recipeImage": "https://example.com/cake.jpg",
    "cuisine": "Dessert"
  }'
```

## 🗄️ Database Schema

### Core Models

#### User

```typescript
{
  id: string              // CUID primary key
  name: string           // User's display name
  email: string          // Unique email address
  emailVerified: boolean // Email verification status
  image?: string         // Profile image URL
  createdAt: Date        // Account creation date
  updatedAt: Date        // Last update date

  // Legacy fields (backward compatibility)
  authProvider?: string   // Auth provider type
  avatarUrl?: string     // Legacy avatar URL
  dietPreference?: string // User's dietary preferences
}
```

#### Favorite

```typescript
{
  id: string          // CUID primary key
  userId: string      // Foreign key to User
  recipeId: string    // External recipe ID
  recipeName: string  // Recipe display name
  recipeImage?: string // Recipe image URL
  cuisine?: string    // Recipe cuisine type
  dateSaved: Date     // When favorited
  deletedAt?: Date    // Soft delete timestamp
}
```

#### Account (Auth)

```typescript
{
  id: string                    // CUID primary key
  accountId: string            // Account identifier (email)
  providerId: string           // Provider type ("credential")
  userId: string               // Foreign key to User
  password?: string            // Hashed password
  accessToken?: string         // OAuth access token
  refreshToken?: string        // OAuth refresh token
  // ... other OAuth fields
}
```

#### Session

```typescript
{
  id: string        // CUID primary key
  token: string     // Unique session token
  userId: string    // Foreign key to User
  expiresAt: Date   // Session expiration
  ipAddress?: string // Client IP address
  userAgent?: string // Client user agent
  createdAt: Date   // Session creation date
}
```

## 🔐 Authentication

### BetterAuth Integration

This application uses [BetterAuth](https://better-auth.com) for authentication:

-   **Email/Password Authentication** - Secure credential-based auth
-   **Session Management** - JWT tokens with database sessions
-   **Password Security** - bcrypt hashing with 12 rounds
-   **Cookie Security** - HTTP-only, secure, SameSite cookies
-   **CSRF Protection** - Built-in CSRF protection

### Frontend Integration

#### Install BetterAuth Client

```bash
npm install better-auth
```

#### Setup Client

```typescript
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
    baseURL: "http://localhost:4000",
});

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
});

// Get session
const session = await authClient.getSession();

// Make authenticated requests
fetch("/api/users/123/favorites", {
    credentials: "include", // Important!
});
```

### Route Protection

```typescript
import { requireAuth } from "./middleware/auth.js";

// Protect all routes
router.use(requireAuth);

// Protect specific route
router.get("/protected", requireAuth, (req, res) => {
    res.json({ user: req.user });
});
```

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio

# Testing
npm run test         # Run test suite
npm run test:auth    # Test BetterAuth integration
npm run test:manual-auth # Test manual auth fallback

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Project Structure

```
src/
├── config/          # Configuration files
│   ├── auth.ts      # BetterAuth configuration
│   └── logger.ts    # Logging configuration
├── controllers/     # Route controllers
│   ├── authController.ts
│   ├── favoritesController.ts
│   └── manualAuthController.ts
├── middleware/      # Express middleware
│   ├── auth.ts      # BetterAuth middleware
│   └── manualAuth.ts # Manual auth middleware
├── routes/          # API routes
│   ├── auth.ts      # Auth endpoints
│   ├── favorites.ts # Favorites endpoints
│   └── manualAuth.ts # Manual auth endpoints
├── app.ts           # Express app setup
└── server.ts        # Server entry point

prisma/
├── schema.prisma    # Database schema
└── migrations/      # Database migrations

docs/                # Documentation
├── API_DOCUMENTATION.md
├── CONTROLLERS_DOCUMENTATION.md
└── MIDDLEWARE_DOCUMENTATION.md

scripts/             # Utility scripts
├── test-auth.ts     # Auth testing script
└── test-postgres-connection.ts
```

### Development Workflow

1. **Start Development Server**

    ```bash
    npm run dev
    ```

2. **Make Changes**

    - Edit source files in `src/`
    - Server automatically restarts on changes

3. **Test Changes**

    ```bash
    npm run test:auth
    ```

4. **Update Database Schema**

    ```bash
    # Edit prisma/schema.prisma
    npm run db:push
    npm run db:generate
    ```

5. **Commit Changes**
    ```bash
    git add .
    git commit -m "feat: add new feature"
    ```

## 🚀 Deployment

### Production Checklist

-   [ ] Set `NODE_ENV=production`
-   [ ] Use strong `BETTER_AUTH_SECRET` (32+ characters)
-   [ ] Configure production database URL
-   [ ] Set correct `CLIENT_URL` and `SERVER_URL`
-   [ ] Enable HTTPS
-   [ ] Configure CORS for production domain
-   [ ] Set up database backups
-   [ ] Configure monitoring and logging
-   [ ] Set up health checks
-   [ ] Implement rate limiting

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="your-production-secret-32-chars-min"
CLIENT_URL="https://yourapp.com"
SERVER_URL="https://api.yourapp.com"
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check database URL
echo $DATABASE_URL

# Test connection
npm run test:postgres-connection
```

#### Authentication Issues

```bash
# Test auth system
npm run test:auth

# Check cookies in browser dev tools
# Ensure credentials: "include" in fetch requests
```

#### CORS Issues

```bash
# Check CLIENT_URL in .env
# Verify CORS configuration in src/app.ts
```

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development npm run dev

# Check logs
tail -f logs/app.log
```

## 📖 Documentation

-   [API Documentation](docs/API_DOCUMENTATION.md) - Complete API reference
-   [Controllers Documentation](docs/CONTROLLERS_DOCUMENTATION.md) - Controller and service layer docs
-   [Middleware Documentation](docs/MIDDLEWARE_DOCUMENTATION.md) - Middleware and security docs
-   [BetterAuth Documentation](https://better-auth.com) - Official BetterAuth docs
-   [Prisma Documentation](https://prisma.io/docs) - Database ORM docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

-   Follow TypeScript best practices
-   Write tests for new features
-   Update documentation
-   Use conventional commit messages
-   Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

-   [BetterAuth](https://better-auth.com) - Modern authentication library
-   [Prisma](https://prisma.io) - Next-generation ORM
-   [Express.js](https://expressjs.com) - Fast, unopinionated web framework
-   [PostgreSQL](https://postgresql.org) - Advanced open source database

---

## 📞 Support

If you have any questions or need help:

1. Check the [documentation](docs/)
2. Search [existing issues](../../issues)
3. Create a [new issue](../../issues/new)

**Happy coding! 🚀**
