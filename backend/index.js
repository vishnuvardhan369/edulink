// 1. Import Packages & Setup
const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const admin = require('firebase-admin');
const { Pool } = require('pg'); 

// --- Initialize Firebase Admin (for Auth verification in the future) ---
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    serviceAccount = require('./firebase-service-account-key.json');
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon DB connections
    }
});


// --- Express Setup ---
const app = express();
const PORT = process.env.PORT || 4000;
const corsOptions = {
  origin: "https://www.edulink.social",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight for all routes
app.use(express.json());


// --- Azure Storage Setup ---
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
if (!accountName || !accountKey) { 
    console.error("Error: Azure Storage credentials are not set in the .env file.");
    process.exit(1);
}
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// 2. --- ALL API ROUTES ---

// Health Check
app.get('/', (req, res) => res.send('EduLink Backend is running!'));

// PROFILE PICTURE UPLOAD URL
app.post('/api/generate-upload-url', (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).send({ error: 'fileName is required.' });
        const containerName = 'profile-pictures'; 
        const blobName = `${Date.now()}-${fileName}`;
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"), // Write permission
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000) // 1 hour expiry
        }, sharedKeyCredential).toString();
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        res.status(200).send({ uploadUrl, blobName });
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate profile picture upload URL.' });
    }
});

// POST IMAGE UPLOAD URL
app.post('/api/generate-post-upload-url', (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).send({ error: 'fileName is required.' });
        const containerName = 'post-images';
        const blobName = `${Date.now()}-${fileName}`;
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"),
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
        }, sharedKeyCredential).toString();
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        res.status(200).send({ uploadUrl, blobName });
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate post upload URL.' });
    }
});

// POSTS ROUTES
app.post('/api/posts', async (req, res) => {
    const { userId, description, imageUrls } = req.body;
    if (!userId || !description) return res.status(400).send({ error: 'userId and description are required.' });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Insert into posts table
        const postQuery = 'INSERT INTO posts (user_id, description) VALUES ($1, $2) RETURNING post_id';
        const postResult = await client.query(postQuery, [userId, description]);
        const newPostId = postResult.rows[0].post_id;

        // Insert into post_images table if images exist
        if (imageUrls && imageUrls.length > 0) {
            const imageQuery = 'INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)';
            for (const imageUrl of imageUrls) {
                await client.query(imageQuery, [newPostId, imageUrl]);
            }
        }
        
        await client.query('COMMIT'); // Commit transaction
        res.status(201).send({ message: 'Post created successfully', postId: newPostId });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Error creating post:", error);
        res.status(500).send({ error: 'Failed to create post.' });
    } finally {
        client.release();
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.post_id, p.description, p.created_at,
                u.user_id, u.display_name, u.username, u.profile_picture_url,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.post_id) AS like_count,
                (SELECT json_agg(json_build_object('image_url', pi.image_url)) FROM post_images pi WHERE pi.post_id = p.post_id) AS images,
                (SELECT json_agg(json_build_object(
                    'comment_id', c.comment_id, 
                    'comment_text', c.comment_text, 
                    'created_at', c.created_at, 
                    'user_id', cu.user_id, 
                    'display_name', cu.display_name, 
                    'profile_picture_url', cu.profile_picture_url
                )) FROM comments c JOIN users cu ON c.user_id = cu.user_id WHERE c.post_id = p.post_id) AS comments
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            ORDER BY p.created_at DESC;
        `;
        const result = await pool.query(query);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send({ error: 'Failed to fetch posts.' });
    }
});

app.delete('/api/posts/:postId', async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ error: 'User ID is required.' });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if post exists and user owns it
        const postCheck = await client.query('SELECT user_id FROM posts WHERE post_id = $1', [postId]);
        if (postCheck.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        if (postCheck.rows[0].user_id !== userId) {
            return res.status(403).send({ error: 'Forbidden' });
        }
        
        // Delete related data first
        await client.query('DELETE FROM likes WHERE post_id = $1', [postId]);
        await client.query('DELETE FROM comments WHERE post_id = $1', [postId]);
        await client.query('DELETE FROM post_images WHERE post_id = $1', [postId]);
        await client.query('DELETE FROM posts WHERE post_id = $1', [postId]);
        
        await client.query('COMMIT');
        res.status(200).send({ message: 'Post deleted successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error deleting post:", error);
        res.status(500).send({ error: 'Failed to delete post.' });
    } finally {
        client.release();
    }
});

app.post('/api/posts/:postId/like', async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ error: 'userId is required.' });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if post exists
        const postCheck = await client.query('SELECT post_id FROM posts WHERE post_id = $1', [postId]);
        if (postCheck.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        // Check if user already liked the post
        const existingLike = await client.query('SELECT * FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        
        if (existingLike.rows.length > 0) {
            // Unlike
            await client.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        } else {
            // Like
            await client.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
        }
        
        await client.query('COMMIT');
        res.status(200).send({ message: 'Like status updated.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating like status:", error);
        res.status(500).send({ error: 'Failed to update like status.' });
    } finally {
        client.release();
    }
});

app.post('/api/posts/:postId/comment', async (req, res) => {
    const { postId } = req.params;
    const { userId, text } = req.body;
    if (!userId || !text) return res.status(400).send({ error: 'userId and text are required.' });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if post exists
        const postCheck = await client.query('SELECT post_id FROM posts WHERE post_id = $1', [postId]);
        if (postCheck.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        // Add comment
        const commentQuery = 'INSERT INTO comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING comment_id';
        await client.query(commentQuery, [postId, userId, text]);
        
        // Get updated post with comments
        const updatedPostQuery = `
            SELECT 
                p.post_id, p.description, p.created_at,
                u.user_id, u.display_name, u.username, u.profile_picture_url,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.post_id) AS like_count,
                (SELECT json_agg(json_build_object('image_url', pi.image_url)) FROM post_images pi WHERE pi.post_id = p.post_id) AS images,
                (SELECT json_agg(json_build_object(
                    'comment_id', c.comment_id, 
                    'comment_text', c.comment_text, 
                    'created_at', c.created_at, 
                    'user_id', cu.user_id, 
                    'display_name', cu.display_name, 
                    'profile_picture_url', cu.profile_picture_url
                )) FROM comments c JOIN users cu ON c.user_id = cu.user_id WHERE c.post_id = p.post_id) AS comments
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            WHERE p.post_id = $1;
        `;
        const result = await client.query(updatedPostQuery, [postId]);
        
        await client.query('COMMIT');
        res.status(201).send(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error adding comment:", error);
        res.status(500).send({ error: 'Failed to add comment.' });
    } finally {
        client.release();
    }
});


// --- USER & CONNECTION ROUTES (Migrated to PostgreSQL) ---

app.post('/api/users', async (req, res) => {
    const { userId, username, email, displayName, profilePictureUrl } = req.body;
    if (!userId || !username || !email || !displayName) {
        return res.status(400).send({ error: 'Missing required user fields.' });
    }
    try {
        const query = `
            INSERT INTO users (user_id, username, email, display_name, profile_picture_url) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, username, email, displayName, profilePictureUrl || null]);
        res.status(201).send(result.rows[0]);
    } catch (error) {
        console.error("Error creating user profile:", error);
        res.status(500).send({ error: 'Failed to create user profile.' });
    }
});

app.get('/api/users/search', async (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 2) return res.status(200).send([]);
    
    try {
        const searchQuery = `
            SELECT user_id, username, display_name, profile_picture_url, bio
            FROM users 
            WHERE LOWER(display_name) LIKE LOWER($1) OR LOWER(username) LIKE LOWER($1)
            LIMIT 10;
        `;
        const result = await pool.query(searchQuery, [`%${query}%`]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).send({ error: 'Failed to search for users.' });
    }
});

app.post('/api/users/:userId/follow', async (req, res) => {
    const { userId: userToFollowId } = req.params;
    const { currentUserId } = req.body;
    if (!currentUserId || userToFollowId === currentUserId) return res.status(400).send({ error: 'Invalid request.' });

    try {
        const query = 'INSERT INTO user_connections (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
        await pool.query(query, [currentUserId, userToFollowId]);
        res.status(200).send({ message: 'Successfully followed user.' });
    } catch (error) {
        console.error("Error following user:", error);
        res.status(500).send({ error: 'Failed to follow user.' });
    }
});

app.post('/api/users/:userId/unfollow', async (req, res) => {
    const { userId: userToUnfollowId } = req.params;
    const { currentUserId } = req.body;
    if (!currentUserId) return res.status(400).send({ error: 'Current user ID is required.' });

    try {
        const query = 'DELETE FROM user_connections WHERE follower_id = $1 AND following_id = $2';
        await pool.query(query, [currentUserId, userToUnfollowId]);
        res.status(200).send({ message: 'Successfully unfollowed user.' });
    } catch (error) {
        console.error("Error unfollowing user:", error);
        res.status(500).send({ error: 'Failed to unfollow user.' });
    }
});

app.post('/api/users/:userId/request-connect', async (req, res) => {
    const { userId: recipientId } = req.params;
    const { currentUserId: senderId } = req.body;
    if (!senderId || recipientId === senderId) return res.status(400).send({ error: 'Invalid request.' });
    
    try {
        const query = 'INSERT INTO connection_requests (sender_id, recipient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
        await pool.query(query, [senderId, recipientId]);
        res.status(200).send({ message: 'Connection request sent.' });
    } catch (error) {
        console.error("Error sending connection request:", error);
        res.status(500).send({ error: 'Failed to send connection request.' });
    }
});

app.post('/api/users/:userId/accept-connect', async (req, res) => {
    const { userId: senderId } = req.params;
    const { currentUserId: recipientId } = req.body;
    if (!recipientId || senderId === recipientId) return res.status(400).send({ error: 'Invalid request.' });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Remove connection request
        await client.query('DELETE FROM connection_requests WHERE sender_id = $1 AND recipient_id = $2', [senderId, recipientId]);
        
        // Add mutual connection
        await client.query('INSERT INTO user_connections (follower_id, following_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING', [senderId, recipientId]);
        
        await client.query('COMMIT');
        res.status(200).send({ message: 'Connection accepted.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error accepting connection:", error);
        res.status(500).send({ error: 'Failed to accept connection.' });
    } finally {
        client.release();
    }
});

app.post('/api/users/:userId/cancel-request', async (req, res) => {
    const { userId: recipientId } = req.params;
    const { currentUserId: senderId } = req.body;

    try {
        const query = 'DELETE FROM connection_requests WHERE sender_id = $1 AND recipient_id = $2';
        await pool.query(query, [senderId, recipientId]);
        res.status(200).send({ message: 'Request cancelled.' });
    } catch (error) {
        console.error("Error cancelling request:", error);
        res.status(500).send({ error: 'Failed to cancel request.' });
    }
});

app.post('/api/users/notifications', async (req, res) => {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return res.status(200).send([]);
    
    try {
        const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
        const query = `
            SELECT user_id, display_name, username, profile_picture_url, bio
            FROM users 
            WHERE user_id IN (${placeholders})
        `;
        const result = await pool.query(query, userIds);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching notification data:", error);
        res.status(500).send({ error: 'Failed to fetch notification data.' });
    }
});



// 3. Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
