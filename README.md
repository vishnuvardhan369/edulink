# EduLink - Real-time Chat & Video Calling Platform

A modern web application built with React, Node.js, Socket.IO, and WebRTC for real-time messaging and video calling.

## 🎯 Features

- **Real-time Messaging** - Instant messaging with Socket.IO
- **Video & Audio Calls** - WebRTC-powered calls with ExpressTurn relay
- **Screen Sharing** - Share your screen during calls
- **User Authentication** - Firebase Authentication
- **File Storage** - Azure Blob Storage integration
- **PostgreSQL Database** - DigitalOcean managed database

## 🏗️ Architecture

```
├── backend/          # Node.js + Socket.IO server
├── edulink-app/      # React frontend
└── .github/          # GitHub Actions workflows
```

## 🚀 Deployment (Azure App Service)

### Backend Environment Variables

Add these to your Azure App Service Configuration:

```bash
NODE_ENV=production
PORT=8080

# Database
DATABASE_URL=postgresql://your_db_connection_string

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account"...}

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=your_account_name
AZURE_STORAGE_ACCOUNT_KEY=your_account_key

# WebRTC TURN Server (ExpressTurn)
EXPRESSTURN_URL=turn:relay1.expressturn.com:3480
EXPRESSTURN_USERNAME=your_username
EXPRESSTURN_PASSWORD=your_password
```

### Frontend Configuration

The frontend automatically detects production environment and uses:
- Backend API: `https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net`
- Socket.IO: Same URL as backend

## 🛠️ Local Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd edulink-app
npm install
npm run dev
```

## 📋 Tech Stack

**Backend:**
- Node.js + Express
- Socket.IO (real-time communication)
- PostgreSQL (database)
- Firebase Admin (authentication)
- Azure Blob Storage (file storage)

**Frontend:**
- React + Vite
- Socket.IO Client
- WebRTC (native)
- Firebase Auth

**Deployment:**
- Azure App Service
- GitHub Actions CI/CD
- ExpressTurn TURN Server

## 🔧 Key Features Implemented

### Real-time Communication
- ✅ Socket.IO connection management
- ✅ Room-based messaging
- ✅ Online/offline status tracking
- ✅ Typing indicators
- ✅ Message persistence

### WebRTC Calling System
- ✅ Audio calls
- ✅ Video calls  
- ✅ Screen sharing
- ✅ ExpressTurn TURN server integration
- ✅ Call notifications
- ✅ Call management (answer/decline/end)

### UI/UX Improvements
- ✅ Responsive design
- ✅ Modern chat interface
- ✅ Call controls with debouncing
- ✅ Connection status indicators
- ✅ Error handling and user feedback

### Performance & Stability
- ✅ Singleton socket manager
- ✅ React Strict Mode compatibility
- ✅ Duplicate event prevention
- ✅ Connection recovery
- ✅ Memory leak prevention

## 🔒 Security Features

- Firebase Authentication
- CORS configuration for production
- Input validation and sanitization
- Secure WebRTC connections with TURN relay
- Environment variable protection

## 📱 Cross-Device Testing

The application works across:
- Desktop browsers (Chrome, Firefox, Safari)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Different networks (WiFi, mobile data)
- Cross-platform video calling

## 🌐 Production URLs

- **App**: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net
- **API**: Same as above
- **Socket.IO**: Same as above

---

*Built with ❤️ for seamless real-time communication*