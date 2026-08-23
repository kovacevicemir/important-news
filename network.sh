#!/usr/bin/env bash
# Start Tech Intelligence Digest on the local network (port 3005)
# Access from your phone: http://<YOUR_IP>:3005
set -e

cd "$(dirname "$0")"

echo "================================================"
echo "  Tech Intelligence Digest — Network Mode"
echo "================================================"
echo ""

# Detect local IP
LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP 'inet \K[\d.]+' | grep -v '127.0.0.1' | head -1)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="<your-ip>"
fi

echo "  Your local IP: $LOCAL_IP"
echo "  Phone URL:     http://$LOCAL_IP:3005"
echo ""

# Start server bound to 0.0.0.0
export HOST=0.0.0.0
export PORT=3005

echo "Starting server... (Ctrl+C to stop)"
echo ""

node src/server.js
