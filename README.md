# Chef Backend - Smart Recipe Generator API

A powerful Node.js backend service that powers the Chef recipe discovery platform with AI-driven ingredient recognition and semantic recipe search capabilities.

## 🚀 Features

-   **AI-Powered Ingredient Recognition** from uploaded photos
-   **Semantic Recipe Search** using vector embeddings
-   **User Authentication & Session Management**
-   **Favorites System** with UUID-based architecture
-   **Recipe Database** with 6,871+ curated recipes
-   **Dietary Filtering** (vegetarian, vegan, gluten-free, etc.)
-   **Image Upload & Processing**
-   **RESTful API** with comprehensive error handling

## 🛠 Tech Stack

### Core Technologies

-   **Runtime**: Node.js 20.x
-   **Language**: TypeScript 5.x
-   **Framework**: Express.js 5.x
-   **Database**: PostgreSQL (Railway)
-   **ORM**: Prisma 5.22.0
-   **Authentication**: Better Auth 1.3.27

### AI & Machine Learning

-   **Embeddings**: Google Generative AI (text-embedding-004)
-   **Vector Database**: Pinecone Database 5.1.2
-   **Image Processing**: Google Gemini AI
-   **Semantic Search**: LangChain integration

### Cloud Services

-   **File Storage**: AWS S3 (via AWS SDK v2)
-   **Image Processing**: Google Cloud Vision API
-   **Vector Search**: Pinecone Cloud
-   **Database Hosting**: Railway PostgreSQL

### Development Tools

-   **Build Tool**: TSX 4.20.6
-   **Process Manager**: tsx watch
-   **Environment**: dotenv 17.2.3
-   **Logging**: Pino 10.0.0
-   **HTTP Client**: node-fetch 3.3.2

### Security & Middleware

-   **CORS**: cors 2.8.5
-   **Compression**: compression 1.8.1
-   **Cookie Parser**: cookie-parser 1.4.7
-   **Password Hashing**: bcrypt 6.0.0
-   **JWT**: jsonwebtoken 9.0.2

## 📁 Project Structure

```
fuzzy-enigma-backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── auth.ts       # Better Auth configuration
│   │   └── logger.ts     # Pino logger setup
│   ├── controllers/      # Route controllers
│   │   ├── authController.ts
│   │   ├── favoritesController.ts
│   │   ├── searchController.ts
│   │   └── uploadController.ts
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts       # Authentication middleware
│   │   └── cors.ts       # CORS configuration
│   ├── repositories/     # Data access layer
│   │   └── FavoriteRepository.ts
│   ├── routes/           # API routes
│   │   ├── auth.ts       # Authentication routes
│   │   ├── favorites.ts  # Favorites CRUD
│   │   ├── search.ts     # Recipe search
│   │   └── upload.ts     # Image upload
│   ├── types/            # TypeScript definitions
│   │   ├── api.ts        # API types
│   │   └── database.ts   # Database types
│   ├── utils/            # Utility functions
│   │   ├── aggregate.ts  # Search result aggregation
│   │   └── clients.ts    # External service clients
│   ├── database/         # Database configuration
│   │   └── client.ts     # Prisma client
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── scripts/             # Utility scripts
│   ├── ingestRecipes.ts # Recipe data ingestion
│   ├── createPineconeIndex.ts
│   └── migration scripts
├── prisma/              # Database schema & migrations
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
├── ingest-cache/        # Recipe ingestion cache
└── migration-backups/   # Migration backup files
```

## 🗄 Database Schema

### Core Models

-   **Users**: Authentication and profile data
-   **Recipes**: Recipe metadata with UUID primary keys
-   **Favorites**: User-recipe relationships
-   **Sessions**: User session management
-   **Accounts**: OAuth account linking

### Key Relationships

-   Users → Favorites (One-to-Many)
-   Recipes → Favorites (One-to-Many)
-   Users → Sessions (One-to-Many)

## 🔧 API Endpoints

### Authentication

```
POST   /api/auth/sign-up     # User registration
POST   /api/auth/sign-in     # User login
POST   /api/auth/sign-out    # User logout
GET    /api/auth/session     # Get current session
```

### Recipe Search

```
POST   /api/search           # Search recipes by ingredients
```

### Favorites Management

```
GET    /api/users/:userId/favorites              # Get user favorites
POST   /api/users/:userId/favorites              # Add to favorites
DELETE /api/users/:userId/favorites/:recipeId    # Remove favorite
GET    /api/users/:userId/favorites/:recipeId/status  # Check status
POST   /api/users/:userId/favorites/:recipeId/toggle  # Toggle favorite
```

### Image Upload

```
POST   /api/upload           # Upload image for ingredient extraction
```

### Profile Management

```
GET    /api/profile          # Get user profile
PUT    /api/profile          # Update profile
```

## 🚀 Getting Started

### Prerequisites

-   Node.js 20.x or higher
-   PostgreSQL database
-   Pinecone account
-   Google AI API key
-   AWS S3 bucket (optional)

### Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# Authentication
BETTER_AUTH_SECRET="your-secret-key"
CLIENT_URL="http://localhost:3000"
SERVER_URL="http://localhost:4000"

# AI Services
GEMINI_API_KEY="your-gemini-api-key"
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_ENV="your-pinecone-environment"
PINECONE_INDEX="recipes-v1"
PINECONE_NAMESPACE="production"

# AWS
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket-name"

# Recipe Data
CSV_PATH="recipes_with_images.csv"
BATCH_SIZE=200
CHUNK_SIZE_CHARS=2000
```

### Installation & Setup

1. **Install Dependencies**

```bash
npm install
```

2. **Setup Database**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) View database
npx prisma studio
```

3. **Create Pinecone Index**

```bash
npm run create:pinecone-index
```

4. **Ingest Recipe Data**

```bash
# Place your CSV file in the root directory
npm run ingest:recipes
```

5. **Start Development Server**

```bash
npm run dev
```

The server will start on `http://localhost:4000`

## 📊 Recipe Data Ingestion

The system includes a sophisticated recipe ingestion pipeline:

### Data Processing

-   **CSV Parsing**: Processes recipe CSV files
-   **Text Chunking**: Splits long recipes into searchable chunks
-   **Embedding Generation**: Creates vector embeddings using Google AI
-   **Dual Storage**: Stores in both PostgreSQL and Pinecone

### Ingestion Features

-   **Checkpoint System**: Resume interrupted ingestions
-   **Batch Processing**: Efficient bulk operations
-   **Error Handling**: Graceful failure recovery
-   **Progress Tracking**: Real-time ingestion status

### Data Format

Expected CSV columns:

-   `RecipeName` / `TranslatedRecipeName`
-   `Ingredients` / `TranslatedIngredients`
-   `Instructions` / `TranslatedInstructions`
-   `Cuisine`, `Course`, `Diet`
-   `PrepTimeInMins`, `CookTimeInMins`, `Servings`
-   `ImageURL`, `URL`

## 🔍 Search Algorithm

### Vector Search Process

1. **Query Embedding**: Convert search query to vector
2. **Similarity Search**: Find similar recipes in Pinecone
3. **Result Aggregation**: Group chunks by recipe
4. **Scoring**: Combine relevance scores
5. **Filtering**: Apply dietary restrictions
6. **Ranking**: Sort by relevance and user preferences

### Search Features

-   **Semantic Matching**: Understanding ingredient relationships
-   **Dietary Filtering**: Automatic restriction application
-   **Relevance Scoring**: Multi-factor ranking algorithm
-   **Result Limiting**: Optimized response sizes

## 🔐 Security Features

-   **Session-based Authentication**: Secure user sessions
-   **Password Hashing**: bcrypt with salt rounds
-   **CORS Protection**: Configured for frontend domain
-   **Input Validation**: Comprehensive request validation
-   **SQL Injection Prevention**: Prisma ORM protection
-   **Rate Limiting**: Built-in request throttling

## 📈 Performance Optimizations

-   **Database Indexing**: Optimized query performance
-   **Connection Pooling**: Efficient database connections
-   **Caching**: Strategic caching layers
-   **Compression**: Response compression middleware
-   **Batch Operations**: Bulk database operations

## 🧪 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes
npm run db:migrate      # Run migrations
npm run db:studio       # Open Prisma Studio

# Data Management
npm run create:pinecone-index  # Create Pinecone index
npm run ingest:recipes         # Ingest recipe data
```

## 🚨 Error Handling

The API implements comprehensive error handling:

-   **Validation Errors**: Input validation with detailed messages
-   **Database Errors**: Graceful database error handling
-   **AI Service Errors**: Fallback mechanisms for AI failures
-   **Authentication Errors**: Clear auth error responses
-   **Rate Limiting**: Request throttling with informative responses

## 📝 Logging

Structured logging with Pino:

-   **Request Logging**: All API requests logged
-   **Error Tracking**: Detailed error information
-   **Performance Metrics**: Response time tracking
-   **Debug Information**: Development debugging support

## 🔄 Migration System

Robust migration system for schema changes:

-   **Backup Creation**: Automatic data backups
-   **Rollback Support**: Safe migration rollbacks
-   **Progress Tracking**: Migration status monitoring
-   **Data Integrity**: Validation checks

## 📄 License

This project is licensed under the ISC License.

---

Built with ❤️ by Supratim Ghose.
