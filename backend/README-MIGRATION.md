# EduLink Backend - Firestore to Neon PostgreSQL Migration

This document outlines the migration from Firebase Firestore to Neon PostgreSQL database.

## Changes Made

### 1. Database Connection
- **Before**: Firebase Firestore
- **After**: Neon PostgreSQL with `pg` client
- Firebase is now used only for authentication

### 2. Dependencies Added
- `pg@^8.11.3` - PostgreSQL client for Node.js

### 3. Environment Variables Required
Update your `.env` file with:
```
DATABASE_URL=your_neon_connection_string_here
```

### 4. Database Schema
The new PostgreSQL schema includes:
- `users` - User profiles and authentication data
- `posts` - Social media posts
- `post_images` - Images associated with posts
- `likes` - Post likes tracking
- `comments` - Post comments
- `user_connections` - Follow/following relationships
- `connection_requests` - Pending connection requests

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Copy `.env.example` to `.env` and fill in your Neon connection string:
```bash
cp .env.example .env
```

### 3. Initialize Database
Run the database initialization script to create tables and indexes:
```bash
npm run init-db
```

### 4. Start the Server
```bash
npm start
```

## API Endpoints Updated

All endpoints have been migrated to use PostgreSQL instead of Firestore:

### Posts
- `POST /api/posts` - Create post
- `GET /api/posts` - Get all posts with user data, images, likes, and comments
- `DELETE /api/posts/:postId` - Delete post
- `POST /api/posts/:postId/like` - Toggle like on post
- `POST /api/posts/:postId/comment` - Add comment to post

### Users
- `POST /api/users` - Create/update user profile
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId` - Update user profile
- `GET /api/users/search` - Search users by name/username
- `GET /api/users/:userId/connections` - Get user connections (followers/following/requests)

### Connections
- `POST /api/users/:userId/follow` - Follow user
- `POST /api/users/:userId/unfollow` - Unfollow user
- `POST /api/users/:userId/request-connect` - Send connection request
- `POST /api/users/:userId/accept-connect` - Accept connection request
- `POST /api/users/:userId/cancel-request` - Cancel connection request

### Notifications
- `POST /api/users/notifications` - Get user data for notifications

## Key Differences from Firestore

1. **Structured Data**: PostgreSQL uses normalized tables instead of documents
2. **Relationships**: Foreign keys enforce data integrity
3. **Performance**: Optimized with indexes for common queries
4. **Transactions**: Better support for atomic operations
5. **SQL Queries**: More complex queries possible with SQL joins

## Migration Notes

- User authentication still handled by Firebase
- All user data is now stored in PostgreSQL
- Post images are stored as separate records linked to posts
- Likes and comments are stored in separate tables for better performance
- Connection relationships use a proper many-to-many table structure

## Deployment

The backend is configured to work with Azure deployment. Make sure to:
1. Set the `DATABASE_URL` environment variable in Azure
2. Keep all other environment variables (Firebase, Azure Storage)
3. The application will automatically connect to Neon PostgreSQL on startup
