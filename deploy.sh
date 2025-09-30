#!/bin/bash

# EduLink Deployment Script

echo "🚀 Starting EduLink deployment process..."

# Check if we're in the right directory
if [ ! -f "edulink-app/package.json" ]; then
    echo "❌ Error: Please run this script from the root project directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd edulink-app
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed! dist directory not found."
    exit 1
fi

echo "✅ Build completed successfully!"

# Optional: Preview the build
echo "🔍 Starting preview server..."
echo "Preview will be available at: http://localhost:4173"
echo "Press Ctrl+C to stop the preview server"
npm run preview

echo "🎉 Deployment process completed!"
echo ""
echo "📋 Next steps:"
echo "1. For GitHub Pages: Push to main branch and enable GitHub Pages in repository settings"
echo "2. For manual deployment: Copy the contents of edulink-app/dist to your web server"
echo "3. For Azure: Deploy the backend and update the production URLs in api.js"