# EduLink Deployment Guide

## Quick Start

### For Local Development
```bash
# Windows
.\deploy.ps1 -Target local

# Linux/Mac
./deploy.sh
```

### For GitHub Pages
```bash
# Windows
.\deploy.ps1 -Target github

# Then push to main branch - GitHub Actions will handle the rest
```

### For Azure App Service
```bash
# Windows
.\deploy.ps1 -Target azure
```

## Environment Configuration

The application automatically detects its environment and configures API endpoints accordingly:

### Supported Platforms
- **Localhost**: `http://localhost:5173` (development)
- **Local Network**: `http://[YOUR-IP]:5173` (cross-device testing)
- **GitHub Pages**: `https://vishnuvardhan369.github.io/edulink`
- **Azure**: `https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net`

### API Endpoints
All environments use the Azure backend:
- **Backend**: `https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net`
- **WebSocket**: `https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net`

## Features Working Status

✅ **Authentication** - Firebase Auth integration  
✅ **Real-time Chat** - Socket.IO messaging  
✅ **Audio Calls** - WebRTC with TURN server  
✅ **Video Calls** - WebRTC with camera support  
✅ **Screen Sharing** - WebRTC screen capture  
✅ **Cross-device Testing** - Local network support  

## Testing WebRTC Features

### Local Network Testing
1. Run `.\start-local-network.ps1` to get your IP address
2. Open the app on multiple devices using the same network
3. Test calls between devices

### Production Testing
1. Deploy to GitHub Pages or access Azure URL
2. Open on different devices/browsers
3. Test all WebRTC features

## Troubleshooting

### CORS Issues
- The backend is configured to accept requests from all supported platforms
- GitHub Pages, Netlify, Vercel, and other hosting platforms are whitelisted

### WebRTC Issues
- Application uses TURN server for maximum compatibility
- Falls back to audio-only if video devices are busy
- Comprehensive logging available in browser console

### Build Issues
- Ensure Node.js 18+ is installed
- Run `npm install` in edulink-app directory
- Check that all dependencies are properly installed

## Manual Deployment

### GitHub Pages
1. Enable GitHub Pages in repository settings
2. Set source to "gh-pages" branch
3. GitHub Actions will automatically build and deploy

### Other Platforms
1. Build the app: `npm run build` in edulink-app directory
2. Deploy the `dist` folder contents to your hosting platform
3. Ensure your domain is added to backend CORS configuration