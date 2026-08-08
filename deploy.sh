#!/bin/bash
# One-click Production VPS Setup Script for Zoho MIS Dashboard

set -e

echo "🚀 Starting Production VPS Deployment for Zoho MIS Dashboard..."

# 1. Update packages
sudo apt update && sudo apt install -y docker.io docker-compose git

# 2. Start Docker
sudo systemctl enable --now docker

# 3. Build & Run Docker Containers
echo "📦 Building and starting Docker containers..."
docker-compose up -d --build

echo "✅ Deployment Successful!"
echo "🌐 Web Dashboard is now live on http://$(curl -s ifconfig.me)"
