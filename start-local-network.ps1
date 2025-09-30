# Start EduLink for Local Network Testing
# This script starts both backend and frontend servers for local network access

Write-Host "🚀 Starting EduLink for Local Network Testing..." -ForegroundColor Green
Write-Host "📱 Your devices can access the app at: http://10.12.151.180:5173" -ForegroundColor Yellow
Write-Host ""

# Start backend server in a new PowerShell window
Write-Host "🔧 Starting Backend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node index.js"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend server in a new PowerShell window
Write-Host "🎨 Starting Frontend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\edulink-app'; npm run dev"

Write-Host ""
Write-Host "✅ Both servers are starting..." -ForegroundColor Green
Write-Host ""
Write-Host "📋 Access URLs:" -ForegroundColor Yellow
Write-Host "   Laptop (localhost): http://localhost:5173" -ForegroundColor White
Write-Host "   Mobile/Network:     http://10.12.151.180:5173" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Backend API:" -ForegroundColor Yellow
Write-Host "   Laptop (localhost): http://localhost:3000" -ForegroundColor White
Write-Host "   Mobile/Network:     http://10.12.151.180:3000" -ForegroundColor White
Write-Host ""
Write-Host "📱 To test on mobile:" -ForegroundColor Green
Write-Host "   1. Connect your mobile to the same WiFi network" -ForegroundColor White
Write-Host "   2. Open browser on mobile" -ForegroundColor White
Write-Host "   3. Go to: http://10.12.151.180:5173" -ForegroundColor White
Write-Host ""
Write-Host "❌ To stop servers, close the PowerShell windows that opened" -ForegroundColor Red