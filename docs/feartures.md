# WatchTogether — Features

## Core Experience

### 1. Synchronized Movie Streaming
- Host-controlled play, pause, and seek
- Automatic time-correction for all viewers on join
- Sync state persisted to MongoDB (throttled writes via syncService)
- Visual "Synced / Out of sync" indicator on player
- New joiners immediately receive current playback position

### 2. Live Video with Friends (WebRTC)
- Camera and microphone support via browser `getUserMedia`
- P2P WebRTC for small rooms, mediasoup SFU for scaling
- STUN/TURN for NAT traversal
- Grid layout of CameraTile components
- Graceful fallback: join without camera if permission denied

### 3. Watch Party Rooms
- Create private (invite-only) or public rooms
- Invite via shareable link or send to followers
- Host controls: Play/Pause/Seek, Mute participants, Kick users, Lock room
- Room state persisted — rejoin sessions after disconnect
- Live participant list with join/leave notifications

---

## Streaming

### 4. Adaptive HLS Streaming (Multi-bitrate)
- FFmpeg converts source to 4 quality tiers: 360p, 720p, 1080p, 4K
- HLS.js auto-selects quality based on network bandwidth
- 6-second segment size for low latency
- `.ts` segments cached by CDN/nginx; playlists never cached

### 5. Content Library
- Movie catalog stored in MongoDB
- Full-text search on title, genre, and cast
- Genre-based browsing with `getByGenre` endpoint
- Trending and New sections

### 6. Continue Watching
- Per-profile watch progress saved on every sync event
- Resumes from `progress` seconds on re-open
- Progress bar overlay on movie cards

### 7. Smart Search
- MongoDB `$text` index on title, genre, cast
- Instant suggestions via 300ms debounce on frontend
- Ranked by text relevance score

---

## Social Features

### 8. Follow System
- Send/cancel/accept/reject follow requests
- Private accounts require approval
- Follower and following counts updated atomically
- `follow_accepted` notification sent to requester

### 9. Share Movies & Watch Parties
- Share movies or party invites to all followers or specific users
- Uses `insertMany` for bulk share creation
- Notification delivered to each recipient
- One-click Watch / Join from shared feed

### 10. Real-Time Notifications
- Delivered via Socket.io to user's personal room `user:<id>`
- Types: follow_request, follow_accepted, movie_share, party_invite, join_alert
- Unread badge count on NotificationBell
- Mark individual or all as read

### 11. Shared With You Feed
- Aggregated view of all shares received
- Sorted newest first
- Shows sender, content, and timestamp

### 12. Friends Are Watching
- Users emit `watching_status` when entering a room
- Followers receive `friend_watching` socket event
- Frontend can show live indicator and instant-join prompt

---

## User & Profile Features

### 13. Multiple Profiles
- Each account supports multiple profiles (like Netflix)
- Separate watch history and genre preferences per profile
- `activeProfile` index selects which profile is active

### 14. Personalized Recommendations
- `continue-watching` endpoint filters in-progress movies
- Genre preferences stored in profile
- (Extend: collaborative filtering using watch history)

### 15. My Watch Parties
- `GET /watchparty/mine` returns all rooms for user
- Active rooms show Rejoin button
- Historical rooms show participant count

---

## Cross-Platform

### 16. Watch Anywhere
- React SPA works on mobile, tablet, desktop, smart TV browser
- Responsive CSS grid layouts
- Touch-friendly controls

### 17. Cross-Device Sync
- JWT stored in localStorage — persists across tabs
- Watch progress saved server-side, restored on any device

---

## Security & Performance

### 18. Secure Streaming
- `verifyStreamToken` middleware on HLS server
- JWT-protected all API endpoints
- bcrypt password hashing (cost factor 12)
- Rate limiting: 200 req/15min general, 5 req/min for auth

### 19. High Performance
- Nginx reverse proxy with gzip compression
- HLS `.ts` segments cached 24h by nginx
- Redis for Socket.io adapter (multi-instance scaling)
- MongoDB indexes on all frequently queried fields
- CDN-ready: swap HLS static dir for S3 origin

### 20. Room Moderation
- Host-only `mute_user` and `kick_user` socket events
- `isLocked` flag prevents new participants
- `kicked` event navigates removed users away from room