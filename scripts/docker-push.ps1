# Docker Push Script for Koge Kanban
# This script builds, tags, and pushes the Docker image to a registry.

$IMAGE_NAME = "dezuhan/koge-kanban"
$TAG = "latest"

Write-Host "🚀 Starting Docker Build and Push process..." -ForegroundColor Cyan

# 1. Build the image
Write-Host "📦 Building image: $IMAGE_NAME:$TAG..." -ForegroundColor Yellow
docker build -t "$IMAGE_NAME:$TAG" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Please check the errors above." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Push the image
Write-Host "📤 Pushing image to registry..." -ForegroundColor Yellow
docker push "$IMAGE_NAME:$TAG"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed. Make sure you are logged in using 'docker login'." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "✅ Successfully pushed $IMAGE_NAME:$TAG" -ForegroundColor Green
Write-Host "You can now pull this image using: docker pull $IMAGE_NAME:$TAG" -ForegroundColor White
