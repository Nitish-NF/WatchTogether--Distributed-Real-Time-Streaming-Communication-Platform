# WatchTogether — Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 20+
- FFmpeg (for video conversion)
- A domain name
- A TURN server (Metered.ca free tier or self-hosted coturn)

---

## Local Development (No Docker)

```bash
# 1. MongoDB & Redis (via Docker)
docker run -d -p 27017:27017 --name wt-mongo mongo:7
docker run -d -p 6379:6379  --name wt-redis redis:7-alpine

# 2. Backend
cd backend
cp .env.example .env        # fill in values
npm install
npm run dev                 # nodemon, port 5000

# 3. WebRTC server
cd webrtc-server
npm install
npm run dev                 # port 4000

# 4. Stream server
cd streaming/server
npm install express cors dotenv
node stream-server.js       # port 8080

# 5. Frontend
cd frontend
npm install
npm start                   # port 3000
```

---

## Docker Compose (Recommended for staging)

```bash
cd infra/docker

# Copy and edit environment
cp ../../backend/.env.example .env
# Set: JWT_SECRET, HOST_IP (your machine's LAN IP for WebRTC)

# Build and start all services
docker-compose up --build

# Or detached
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f webrtc

# Stop
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Environment Variables for docker-compose

Create `infra/docker/.env`:
```env
JWT_SECRET=your_very_long_random_secret
STREAM_SECRET=another_random_secret
CLIENT_URL=http://localhost:3000
HOST_IP=192.168.1.x         # Your LAN IP — required for mediasoup
NODE_ENV=production
```

---

## Production (Kubernetes)

```bash
# 1. Build and push images
docker build -t your-registry/wt-backend:latest  -f infra/docker/Dockerfile.backend  backend/
docker build -t your-registry/wt-frontend:latest -f infra/docker/Dockerfile.frontend frontend/
docker build -t your-registry/wt-webrtc:latest   -f infra/docker/Dockerfile.webrtc   webrtc-server/

docker push your-registry/wt-backend:latest
docker push your-registry/wt-frontend:latest
docker push your-registry/wt-webrtc:latest

# 2. Update image names in kubernetes/*.yaml

# 3. Update secrets in backend.yaml (or use kubectl secrets)
kubectl create secret generic wt-backend-secrets \
  --from-literal=MONGO_URI="mongodb+srv://..." \
  --from-literal=REDIS_URL="redis://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=CLIENT_URL="https://yourdomain.com"

# 4. Apply manifests
kubectl apply -f infra/kubernetes/backend.yaml
kubectl apply -f infra/kubernetes/frontend.yaml
kubectl apply -f infra/kubernetes/webrtc.yaml

# 5. Check rollout
kubectl rollout status deployment/wt-backend
kubectl get pods
kubectl get services
```

---

## Adding Movies (HLS Pipeline)

```bash
# 1. Copy your .mp4 to streaming/uploads/
cp mymovie.mp4 streaming/uploads/

# 2. Run FFmpeg conversion
cd streaming/ffmpeg
chmod +x convert.sh
./convert.sh ../uploads/mymovie.mp4 mymovie

# Output: streaming/output/mymovie/index.m3u8

# 3. Add the movie to MongoDB
# POST /api/movies
{
  "title": "My Movie",
  "genre": "Action",
  "year": 2024,
  "duration": 7200,
  "streamUrl": "/hls/mymovie/index.m3u8",
  "isTrending": true,
  "color": "#1a237e"
}
```

---

## TURN Server Setup

Required for WebRTC to work across NAT (most real-world connections).

### Option A: Metered.ca (free tier)
1. Sign up at https://metered.ca
2. Copy your TURN credentials
3. Update `webrtc-server/config/turn.json`
4. Set env vars: `REACT_APP_TURN_URL`, `REACT_APP_TURN_USER`, `REACT_APP_TURN_PASS`

### Option B: Self-hosted coturn
```bash
apt install coturn
# Edit /etc/turnserver.conf
# Set listening-port=3478, realm=yourdomain.com, user=user:password
systemctl enable coturn && systemctl start coturn
```

---

## SSL / HTTPS (Required for camera/mic in production)

```bash
# With certbot + nginx
certbot --nginx -d yourdomain.com

# Or use Cloudflare proxy (easiest)
# Set SSL/TLS to "Full" in Cloudflare dashboard
```

> WebRTC camera and microphone access requires HTTPS in all modern browsers.

---

## Health Checks

| Service | URL |
|---|---|
| Backend | http://localhost:5000/health |
| WebRTC | http://localhost:4000/health |
| Stream | http://localhost:8080/health |
| Frontend | http://localhost:3000 |