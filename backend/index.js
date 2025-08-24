// 1. Import Packages & Setup
const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const admin = require('firebase-admin');

// --- Initialize Firebase Admin ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();


// --- Express Setup ---
const app = express();
const PORT = 4000;
app.use(cors());
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
    try {
        const { userId, description, imageUrls } = req.body;
        if (!userId || !description) return res.status(400).send({ error: 'userId and description are required.' });
        const newPost = {
            userId, description,
            imageUrls: imageUrls || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            likes: [], comments: []
        };
        const postRef = await db.collection('posts').add(newPost);
        res.status(201).send({ message: 'Post created successfully', postId: postRef.id });
    } catch (error) {
        res.status(500).send({ error: 'Failed to create post.' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) return res.status(200).send([]);
        const posts = snapshot.docs.map(doc => {
            const data = doc.data();
            const comments = (data.comments || []).map(comment => ({
                ...comment,
                createdAt: comment.createdAt ? comment.createdAt.toMillis() : Date.now(),
            }));
            return { 
                id: doc.id, ...data, 
                createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now(),
                comments
            };
        });
        res.status(200).send(posts);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch posts.' });
    }
});

app.delete('/api/posts/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'User ID is required.' });
        const postRef = db.collection('posts').doc(postId);
        const doc = await postRef.get();
        if (!doc.exists) return res.status(404).send({ error: 'Post not found.' });
        if (doc.data().userId !== userId) return res.status(403).send({ error: 'Forbidden' });
        await postRef.delete();
        res.status(200).send({ message: 'Post deleted successfully.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to delete post.' });
    }
});

app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'userId is required.' });
        const postRef = db.collection('posts').doc(postId);
        const doc = await postRef.get();
        if (!doc.exists) return res.status(404).send({ error: 'Post not found.' });
        const postData = doc.data();
        await postRef.update({
            likes: (postData.likes || []).includes(userId) 
                ? admin.firestore.FieldValue.arrayRemove(userId) 
                : admin.firestore.FieldValue.arrayUnion(userId)
        });
        res.status(200).send({ message: 'Like status updated.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update like status.' });
    }
});

app.post('/api/posts/:postId/comment', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, text } = req.body;
        if (!userId || !text) return res.status(400).send({ error: 'userId and text are required.' });
        const postRef = db.collection('posts').doc(postId);
        const newComment = { userId, text, createdAt: new Date() };
        await postRef.update({ comments: admin.firestore.FieldValue.arrayUnion(newComment) });
        const updatedDoc = await postRef.get();
        const data = updatedDoc.data();
        const comments = (data.comments || []).map(comment => ({
            ...comment,
            createdAt: comment.createdAt ? comment.createdAt.toMillis() : Date.now(),
        }));
        const updatedPost = { 
            id: updatedDoc.id, ...data,
            createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now(),
            comments
        };
        res.status(201).send(updatedPost);
    } catch (error) {
        res.status(500).send({ error: 'Failed to add comment.' });
    }
});

// USER & CONNECTION ROUTES
app.get('/api/users/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) return res.status(200).send([]);
        const lowerCaseQuery = query.toLowerCase();
        const usersRef = db.collection('users');
        const nameQuery = usersRef.where('displayName_lowercase', '>=', lowerCaseQuery).where('displayName_lowercase', '<=', lowerCaseQuery + '\uf8ff').limit(10);
        const usernameQuery = usersRef.where('username', '>=', lowerCaseQuery).where('username', '<=', lowerCaseQuery + '\uf8ff').limit(10);
        const [nameSnapshot, usernameSnapshot] = await Promise.all([nameQuery.get(), usernameQuery.get()]);
        const resultsMap = new Map();
        nameSnapshot.forEach(doc => {
            const { email, displayName_lowercase, ...userData } = doc.data();
            resultsMap.set(doc.id, { id: doc.id, ...userData });
        });
        usernameSnapshot.forEach(doc => {
            const { email, displayName_lowercase, ...userData } = doc.data();
            resultsMap.set(doc.id, { id: doc.id, ...userData });
        });
        res.status(200).send(Array.from(resultsMap.values()));
    } catch (error) {
        res.status(500).send({ error: 'Failed to search for users.' });
    }
});

app.post('/api/users/:userId/follow', async (req, res) => {
    try {
        const { userId: userToFollowId } = req.params;
        const { currentUserId } = req.body;
        if (!currentUserId || userToFollowId === currentUserId) return res.status(400).send({ error: 'Invalid request.' });
        const currentUserRef = db.collection('users').doc(currentUserId);
        const userToFollowRef = db.collection('users').doc(userToFollowId);
        const batch = db.batch();
        batch.update(currentUserRef, { following: admin.firestore.FieldValue.arrayUnion(userToFollowId) });
        batch.update(userToFollowRef, { followers: admin.firestore.FieldValue.arrayUnion(currentUserId) });
        await batch.commit();
        res.status(200).send({ message: 'Successfully followed user.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to follow user.' });
    }
});

app.post('/api/users/:userId/unfollow', async (req, res) => {
    try {
        const { userId: userToUnfollowId } = req.params;
        const { currentUserId } = req.body;
        if (!currentUserId) return res.status(400).send({ error: 'Current user ID is required.' });
        const currentUserRef = db.collection('users').doc(currentUserId);
        const userToUnfollowRef = db.collection('users').doc(userToUnfollowId);
        const batch = db.batch();
        batch.update(currentUserRef, { following: admin.firestore.FieldValue.arrayRemove(userToUnfollowId) });
        batch.update(userToUnfollowRef, { followers: admin.firestore.FieldValue.arrayRemove(currentUserId) });
        await batch.commit();
        res.status(200).send({ message: 'Successfully unfollowed user.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to unfollow user.' });
    }
});

app.post('/api/users/:userId/request-connect', async (req, res) => {
    try {
        const { userId: recipientId } = req.params;
        const { currentUserId: senderId } = req.body;
        if (!senderId || recipientId === senderId) return res.status(400).send({ error: 'Invalid request.' });
        const senderRef = db.collection('users').doc(senderId);
        const recipientRef = db.collection('users').doc(recipientId);
        const batch = db.batch();
        batch.update(senderRef, { connectionRequestsSent: admin.firestore.FieldValue.arrayUnion(recipientId) });
        batch.update(recipientRef, { connectionRequestsReceived: admin.firestore.FieldValue.arrayUnion(senderId) });
        await batch.commit();
        res.status(200).send({ message: 'Connection request sent.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to send connection request.' });
    }
});

app.post('/api/users/:userId/accept-connect', async (req, res) => {
    try {
        const { userId: senderId } = req.params;
        const { currentUserId: recipientId } = req.body;
        if (!recipientId || senderId === recipientId) return res.status(400).send({ error: 'Invalid request.' });
        const recipientRef = db.collection('users').doc(recipientId);
        const senderRef = db.collection('users').doc(senderId);
        const batch = db.batch();
        batch.update(recipientRef, { connectionRequestsReceived: admin.firestore.FieldValue.arrayRemove(senderId) });
        batch.update(senderRef, { connectionRequestsSent: admin.firestore.FieldValue.arrayRemove(recipientId) });
        batch.update(recipientRef, { following: admin.firestore.FieldValue.arrayUnion(senderId), followers: admin.firestore.FieldValue.arrayUnion(senderId) });
        batch.update(senderRef, { followers: admin.firestore.FieldValue.arrayUnion(recipientId), following: admin.firestore.FieldValue.arrayUnion(recipientId) });
        await batch.commit();
        res.status(200).send({ message: 'Connection accepted.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to accept connection.' });
    }
});

app.post('/api/users/:userId/cancel-request', async (req, res) => {
    try {
        const { userId: recipientId } = req.params;
        const { currentUserId: senderId } = req.body;
        const senderRef = db.collection('users').doc(senderId);
        const recipientRef = db.collection('users').doc(recipientId);
        const batch = db.batch();
        batch.update(senderRef, { connectionRequestsSent: admin.firestore.FieldValue.arrayRemove(recipientId) });
        batch.update(recipientRef, { connectionRequestsReceived: admin.firestore.FieldValue.arrayRemove(senderId) });
        await batch.commit();
        res.status(200).send({ message: 'Request cancelled.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to cancel request.' });
    }
});

app.post('/api/users/notifications', async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return res.status(200).send([]);
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where(admin.firestore.FieldPath.documentId(), 'in', userIds).get();
        const users = snapshot.docs.map(doc => {
            const { email, displayName_lowercase, ...userData } = doc.data();
            return { id: doc.id, ...userData };
        });
        res.status(200).send(users);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch notification data.' });
    }
});


// 3. Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
