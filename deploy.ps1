# EduLink Deployment Script for Windows
# Supports local development, GitHub Pages, and Azure deployment

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "github", "azure")]
    [string]$Target = "local"
)

Write-Host "🚀 Starting EduLink deployment process for: $Target" -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "edulink-app\package.json")) {
    Write-Host "❌ Error: Please run this script from the root project directory" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
Set-Location edulink-app
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies!" -ForegroundColor Red
    exit 1
}

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Check if build was successful
if (!(Test-Path "dist")) {
    Write-Host "❌ Build failed! dist directory not found." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green

switch ($Target) {
    "local" {
        Write-Host "🔍 Starting local preview server..." -ForegroundColor Cyan
        Write-Host "Preview will be available at: http://localhost:4173" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop the preview server" -ForegroundColor Yellow
        npm run preview
    }
    
    "github" {
        Write-Host "📤 Preparing for GitHub Pages deployment..." -ForegroundColor Cyan
        Write-Host "Build files are ready in edulink-app/dist" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Next steps for GitHub Pages:" -ForegroundColor Yellow
        Write-Host "1. Push your changes to the main branch" -ForegroundColor White
        Write-Host "2. Go to your repository settings on GitHub" -ForegroundColor White
        Write-Host "3. Enable GitHub Pages from the gh-pages branch" -ForegroundColor White
        Write-Host "4. The GitHub Action will automatically deploy your app" -ForegroundColor White
    }
    
    "azure" {
        Write-Host "☁️ Preparing for Azure App Service deployment..." -ForegroundColor Cyan
        
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
    }
}

Write-Host "🎉 Deployment process completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Environment URLs:" -ForegroundColor Cyan
Write-Host "• Local development: http://localhost:5173" -ForegroundColor White
Write-Host "• Local network: http://[YOUR-IP]:5173" -ForegroundColor White
Write-Host "• GitHub Pages: https://vishnuvardhan369.github.io/edulink" -ForegroundColor White
Write-Host "• Azure production: https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net" -ForegroundColor White

# Return to original directory
Set-Location ..