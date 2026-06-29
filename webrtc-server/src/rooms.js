/**
 * Room registry.
 * Global room presence + selective media graph.
 * Updated per scalable SFU architecture doc.
 */

const roomMap = new Map(); // roomId → room structure

const createRoomStructure = () => ({
  peers: new Map(),         // socketId → peerInfo
  activeSpeakers: new Set(), // socketIds currently speaking
  mediaGraph: new Map(),    // socketId → Set<socketId> (who consumes whom)
  createdAt: Date.now(),
});

const rooms = {
  addPeer: (roomId, peerInfo) => {
    if (!roomMap.has(roomId)) {
      roomMap.set(roomId, createRoomStructure());
    }
    const room = roomMap.get(roomId);
    room.peers.set(peerInfo.socketId, peerInfo);
  },

  removePeer: (roomId, socketId) => {
    const room = roomMap.get(roomId);
    if (!room) return;
    room.peers.delete(socketId);

    // Clean up mediaGraph entries
    room.mediaGraph.delete(socketId);
    for (const [, connections] of room.mediaGraph.entries()) {
      connections.delete(socketId);
    }

    // Clean up activeSpeakers
    room.activeSpeakers.delete(socketId);

    if (room.peers.size === 0) {
      roomMap.delete(roomId);
    }
  },

  getPeers: (roomId) => {
    const room = roomMap.get(roomId);
    if (!room) return [];
    return Array.from(room.peers.values());
  },

  getRoom: (roomId) => roomMap.get(roomId),

  getRoomCount: () => roomMap.size,

  getAllRooms: () => {
    const result = {};
    for (const [roomId, room] of roomMap.entries()) {
      result[roomId] = Array.from(room.peers.values());
    }
    return result;
  },

  /**
   * Record that fromSocketId is now consuming toSocketId's media.
   * Used to track the selective media graph.
   */
  connectPeers: (roomId, fromSocketId, toSocketId) => {
    const room = roomMap.get(roomId);
    if (!room) return;
    if (!room.mediaGraph.has(fromSocketId)) {
      room.mediaGraph.set(fromSocketId, new Set());
    }
    room.mediaGraph.get(fromSocketId).add(toSocketId);
  },

  disconnectPeers: (roomId, fromSocketId, toSocketId) => {
    const room = roomMap.get(roomId);
    if (!room) return;
    room.mediaGraph.get(fromSocketId)?.delete(toSocketId);
  },

  setActiveSpeaker: (roomId, socketId, isSpeaking) => {
    const room = roomMap.get(roomId);
    if (!room) return;
    if (isSpeaking) {
      room.activeSpeakers.add(socketId);
    } else {
      room.activeSpeakers.delete(socketId);
    }
  },

  getActiveSpeakers: (roomId) => {
    const room = roomMap.get(roomId);
    if (!room) return [];
    return Array.from(room.activeSpeakers);
  },

  /**
   * Get all producers in a room except from the requesting socket.
   * Returns array of { socketId, peerId, userId, username, producerId, kind }
   */
  getProducersInRoom: (roomId, excludeSocketId, peersRegistry) => {
    const room = roomMap.get(roomId);
    if (!room) return [];

    const producers = [];
    for (const [socketId, peerInfo] of room.peers.entries()) {
      if (socketId === excludeSocketId) continue;
      const peer = peersRegistry.get(socketId);
      if (!peer) continue;
      for (const [producerId, producer] of peer.producers.entries()) {
        producers.push({
          socketId,
          peerId: peerInfo.peerId,
          userId: peerInfo.userId,
          username: peerInfo.username,
          producerId,
          kind: producer.kind,
        });
      }
    }
    return producers;
  },
};

module.exports = rooms;