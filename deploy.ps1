# Deploy frontend to Azure App Service

# Build the React app
Write-Host "Building React application..." -ForegroundColor Green
cd "$PSScriptRoot\edulink-app"
npm run build

# Copy build files to backend for serving
Write-Host "Copying build files to backend..." -ForegroundColor Green
$BackendPath = "$PSScriptRoot\backend"
$DistPath = "$PSScriptRoot\edulink-app\dist"

# Create public directory in backend if it doesn't exist
if (!(Test-Path "$BackendPath\public")) {
    New-Item -Path "$BackendPath\public" -ItemType Directory
}

# Copy all files from dist to backend/public
Copy-Item -Path "$DistPath\*" -Destination "$BackendPath\public" -Recurse -Force

Write-Host "Build files copied successfully!" -ForegroundColor Green
Write-Host "Backend is ready for deployment to Azure App Service" -ForegroundColor Yellow

# Display files in public directory
Write-Host "`nFiles in backend/public:" -ForegroundColor Cyan
Get-ChildItem -Path "$BackendPath\public" -Recurse | Format-Table Name, Length, LastWriteTime