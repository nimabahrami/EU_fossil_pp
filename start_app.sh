#!/bin/bash
# Start the power plants web app
cd "$(dirname "$0")"
echo "🚀 Starting EU Power Plants Map..."
echo "📍 Opening http://localhost:8080"
python3 -m http.server 8080
