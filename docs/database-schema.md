# WatchTogether — Database Schema

## MongoDB Collections

---

### users
```js
{
  _id: ObjectId,
  username: String,          // unique, 3-30 chars
  email: String,             // unique, lowercase
  password: String,          // bcrypt hash
  bio: String,               // max 200 chars
  avatar: String,            // URL
  profiles: [{               // sub-profiles (like Netflix)
    name: String,
    avatar: String,
    watchHistory: [{
      movie: ObjectId → movies,
      progress: Number,      // seconds
      watchedAt: Date
    }],
    preferences: {
      genres: [String]
    }
  }],
  activeProfile: Number,     // index into profiles[]
  followersCount: Number,
  followingCount: Number,
  isPrivate: Boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes: email (unique), username (unique)
```

---

### movies
```js
{
  _id: ObjectId,
  title: String,             // required
  description: String,
  genre: String,             // required
  year: Number,
  duration: Number,          // seconds
  director: String,
  cast: [String],
  language: String,
  thumbnail: String,         // URL
  color: String,             // hex fallback gradient color
  streamUrl: String,         // HLS master playlist path
  isTrending: Boolean,
  isNew: Boolean,
  viewCount: Number,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
Indexes: { title: 'text', genre: 'text', cast: 'text' }  // full-text search
```

---

### follows
```js
{
  _id: ObjectId,
  requester: ObjectId → users,   // who sent the request
  recipient: ObjectId → users,   // who received it
  status: 'pending' | 'accepted',
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { requester: 1, recipient: 1 } unique
  { recipient: 1, status: 1 }
  { requester: 1, status: 1 }
```

---

### shares
```js
{
  _id: ObjectId,
  fromUser: ObjectId → users,
  toUser: ObjectId → users,
  type: 'movie' | 'party',
  movieId: ObjectId → movies,
  movieTitle: String,
  roomId: ObjectId → watchparties,
  seen: Boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes: { toUser: 1, createdAt: -1 }
```

---

### notifications
```js
{
  _id: ObjectId,
  userId: ObjectId → users,      // recipient
  type: 'follow_request' | 'follow_accepted' | 'movie_share'
        | 'party_invite' | 'join_alert',
  fromUser: ObjectId → users,
  movieId: ObjectId → movies,
  roomId: ObjectId → watchparties,
  message: String,
  read: Boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { userId: 1, createdAt: -1 }
  { userId: 1, read: 1 }
```

---

### watchparties
```js
{
  _id: ObjectId,
  movieId: ObjectId → movies,
  movieTitle: String,
  streamUrl: String,
  hostId: ObjectId → users,
  participants: [{
    _id: ObjectId → users,
    username: String,
    joinedAt: Date,
    audioMuted: Boolean
  }],
  isPrivate: Boolean,
  isLocked: Boolean,
  active: Boolean,
  syncState: {
    action: 'play' | 'pause' | 'seek',
    time: Number,              // seconds
    updatedAt: Date
  },
  participantCount: Number,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { active: 1, isPrivate: 1 }
  { hostId: 1 }
```

---

## Redis Keys

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `session:<userId>` | String | 7d | JWT session cache |
| `room:<roomId>:state` | Hash | 24h | Active room sync state |
| `ratelimit:<ip>` | Counter | 15m | Rate limit tracking |
| `trending:movies` | List | 10m | Cached trending query |
| `notif:unread:<userId>` | Counter | — | Unread notification count |