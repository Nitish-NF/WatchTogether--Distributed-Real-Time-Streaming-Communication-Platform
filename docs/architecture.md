# WatchTogether — Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  React SPA · HLS.js · Socket.io-client · mediasoup-client  │
└───────────────────┬──────────────────────────────────────────┘
                    │ HTTPS / WSS
           ┌────────▼────────┐
           │   Nginx Proxy    │
           │  (load balancer) │
           └─┬──────┬──────┬─┘
             │      │      │
     ┌───────▼──┐ ┌─▼────┐ ┌▼────────────┐
     │ Frontend │ │ API  │ │ HLS Stream  │
     │ (React)  │ │ :5000│ │ Server :8080│
     └──────────┘ └──┬───┘ └─────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
     ┌────▼───┐ ┌────▼──┐ ┌────▼────┐
     │MongoDB │ │ Redis │ │Socket.io│
     │        │ │ Cache │ │ Server  │
     └────────┘ └───────┘ └────┬────┘
                                │ WebRTC signaling
                         ┌──────▼──────┐
                         │ WebRTC SFU  │
                         │ (mediasoup) │
                         │   :4000     │
                         └─────────────┘
```

## Services

### Frontend (React) — Port 3000
- React 18 SPA with React Router v6
- HLS.js for adaptive video playback
- Socket.io-client for real-time sync, chat, and notifications
- mediasoup-client for WebRTC camera/mic streams
- Global auth state via Context API

### Backend API (Node/Express) — Port 5000
- REST API with modular feature-based architecture
- Socket.io server for WebSocket events (sync, chat, notifications, signaling relay)
- JWT authentication with bcrypt password hashing
- Rate limiting per IP

### WebRTC Server (mediasoup SFU) — Port 4000
- mediasoup Selective Forwarding Unit for scalable multi-party video
- Custom signaling layer over Socket.io
- Falls back to P2P WebRTC for 2-person rooms
- TURN server config for NAT traversal

### HLS Stream Server — Port 8080
- Express static server for .m3u8 and .ts files
- FFmpeg conversion pipeline (multi-bitrate: 360p → 4K)
- Token-based stream authorization
- CDN-ready (swap static dir for S3/CloudFront origin)

### MongoDB
- Primary data store for users, movies, rooms, follows, shares, notifications
- Text indexes on movies for full-text search
- TTL indexes for expired sessions

### Redis
- Socket.io adapter for multi-instance scaling
- Session caching
- Rate limit counters

## Data Flow

### Sync Event Flow
```
Host presses Pause
  → frontend emits sync_event via Socket.io
  → backend socket.js receives, broadcasts to room
  → syncService persists state to MongoDB (throttled 10s)
  → all viewers receive sync_event
  → VideoPlayer applies new state
```

### Watch Party Creation
```
User clicks "Start Party"
  → POST /api/watchparty/create { movieId }
  → WatchParty doc created in MongoDB
  → Backend returns { roomId }
  → User navigated to /party/:roomId
  → Socket.io join_room emitted
  → Other users invited via shareService
```

### WebRTC Camera Flow
```
Peer A joins room
  → Gets list of existing peers from signaling server
  → Creates RTCPeerConnection for each
  → Sends offer via socket
  → Peer B receives offer, sends answer
  → ICE candidates exchanged
  → P2P or SFU media stream established
  → CameraTile renders remote video
```

## Scaling Considerations

| Concern | Solution |
|---|---|
| Multiple backend instances | Redis Socket.io adapter |
| WebRTC at scale | mediasoup SFU (one stream to server, server fans out) |
| Video delivery | CDN in front of HLS server (CloudFront / Cloudflare) |
| DB read load | Redis caching for trending movies, user profiles |
| Auth tokens | Stateless JWT (no server session) |