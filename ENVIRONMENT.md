# Environment Configuration for EduLink

## Development (Localhost)
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- WebSocket: http://localhost:3000

## Local Network Testing
- Frontend: http://10.12.151.180:5173
- Backend: http://10.12.151.180:3000
- WebSocket: http://10.12.151.180:3000

## GitHub Hosting
- Frontend: https://vishnuvardhan369.github.io/edulink
- Backend: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net
- WebSocket: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net

## Production (Azure)
- Frontend: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net
- Backend: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net
- WebSocket: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net

## Supported Hosting Platforms

The application automatically detects and configures itself for:

### Development Environments
- localhost (any port)
- 127.0.0.1
- Local network IPs

### Hosting Platforms
- GitHub Pages (*.github.io)
- GitHub Codespaces (*.github.dev)
- Netlify (*.netlify.app)
- Vercel (*.vercel.app)
- Surge.sh (*.surge.sh)
- Heroku (*.herokuapp.com)
- Azure App Services (*.azurewebsites.net)

## CORS Configuration

The backend is configured to accept requests from all supported hosting platforms and development environments.

## WebRTC Configuration

- Uses TURN server for maximum compatibility
- Supports audio calls, video calls, and screen sharing
- Automatic fallback for different network conditions