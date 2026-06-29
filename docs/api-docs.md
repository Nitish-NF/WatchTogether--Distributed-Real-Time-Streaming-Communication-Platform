# WatchTogether — API Reference

Base URL: `http://localhost:5000/api`

All protected routes require: `Authorization: Bearer <token>`

---

## Auth

### POST /auth/register
```json
Body: { "username": "string", "email": "string", "password": "string" }
Response: { "token": "...", "user": { "_id", "username", "email" } }
```

### POST /auth/login
```json
Body: { "email": "string", "password": "string" }
Response: { "token": "...", "user": { ... } }
```

### GET /auth/me `🔒`
```json
Response: { "user": { ... } }
```

---

## Users

### GET /users/:userId `🔒`
Returns public profile.

### PATCH /users/me `🔒`
```json
Body: { "bio": "string", "avatar": "string" }
```

### GET /users/:userId/history `🔒`
Returns watch history array.

### POST /users/progress/:movieId `🔒`
```json
Body: { "progress": 3600 }   // seconds watched
```

### GET /users/search?q=name `🔒`
Returns matching users array.

---

## Movies

### GET /movies/trending `🔒`
Returns top 20 trending movies.

### GET /movies/new `🔒`
Returns newest movies.

### GET /movies/by-genre `🔒`
Returns `{ "Action": [...], "Drama": [...], ... }`.

### GET /movies/continue-watching `🔒`
Returns in-progress movies for current user.

### GET /movies/search?q=query `🔒`
Full-text search on title, genre, cast.

### GET /movies/:id `🔒`
Returns movie detail + related movies.

### POST /movies `🔒`
Create movie (admin). Body: full movie object.

### PATCH /movies/:id `🔒`
Update movie fields.

### DELETE /movies/:id `🔒`
Delete movie.

---

## Follow

### POST /follow/request/:targetId `🔒`
Send a follow request.

### POST /follow/accept/:requesterId `🔒`
Accept an incoming request.

### DELETE /follow/reject/:requesterId `🔒`
Reject an incoming request.

### DELETE /follow/request/:targetId `🔒`
Cancel a sent request.

### DELETE /follow/:targetId `🔒`
Unfollow an accepted user.

### GET /follow/status/:targetId `🔒`
Returns `{ "status": "none" | "pending" | "following" }`.

### GET /follow/followers/:userId `🔒`
### GET /follow/following/:userId `🔒`

---

## Share

### POST /share/movie `🔒`
```json
Body: { "movieId": "...", "userIds": ["..."] }
// userIds optional — defaults to all followers
```

### POST /share/party `🔒`
```json
Body: { "roomId": "...", "userIds": ["..."] }
```

### GET /share/feed `🔒`
Returns shared items feed for current user.

---

## Notifications

### GET /notifications `🔒`
Returns latest 30 notifications.

### GET /notifications/unread-count `🔒`
Returns `{ "count": 5 }`.

### PATCH /notifications/:id/read `🔒`
Mark one notification as read.

### PATCH /notifications/read-all `🔒`
Mark all notifications as read.

---

## Watch Party

### POST /watchparty/create `🔒`
```json
Body: { "movieId": "..." }
Response: { "_id": "roomId", "streamUrl": "...", ... }
```

### GET /watchparty/public `🔒`
Returns active public rooms.

### GET /watchparty/mine `🔒`
Returns rooms where user is host or participant.

### GET /watchparty/:roomId `🔒`
Returns room details, participants, sync state.

### DELETE /watchparty/:roomId `🔒`
Host closes the room.

### PATCH /watchparty/:roomId/lock `🔒`
Host toggles room lock.

---

## WebSocket Events (Socket.io)

Connect to: `ws://localhost:5000` with `{ auth: { token: "..." } }`

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_room` | `{ roomId }` | Join a watch party room |
| `leave_room` | `{ roomId }` | Leave a room |
| `sync_event` | `{ roomId, event: { action, time } }` | Host broadcasts playback action |
| `chat_message` | `{ roomId, message }` | Send chat to room |
| `mute_user` | `{ roomId, targetId }` | Host mutes a participant |
| `kick_user` | `{ roomId, targetId }` | Host removes a participant |
| `lock_room` | `{ roomId }` | Host toggles lock |
| `offer` | `{ to, offer, roomId }` | WebRTC offer relay |
| `answer` | `{ to, answer, roomId }` | WebRTC answer relay |
| `ice_candidate` | `{ to, candidate, roomId }` | ICE candidate relay |
| `toggle_mic` | `{ roomId, userId, muted }` | Broadcast mic state |
| `watching_status` | `{ movieId, movieTitle }` | Broadcast "friends watching" |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `user_joined` | `{ participant }` | New user joined room |
| `user_left` | `{ userId }` | User left room |
| `sync_event` | `{ action, time }` | Sync playback state |
| `chat_message` | `{ userId, username, text, timestamp }` | New chat message |
| `user_muted` | `{ userId }` | Participant was muted |
| `kicked` | `{ roomId }` | You were removed |
| `room_locked` | `{ lockedBy }` | Room was locked |
| `notification` | `{ type, message, ... }` | Real-time notification |
| `friend_watching` | `{ userId, username, movieId }` | Friend started watching |
| `offer` | `{ fromPeerId, offer }` | Incoming WebRTC offer |
| `answer` | `{ fromPeerId, answer }` | Incoming WebRTC answer |
| `ice_candidate` | `{ fromPeerId, candidate }` | Incoming ICE candidate |