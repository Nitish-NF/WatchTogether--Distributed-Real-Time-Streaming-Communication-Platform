/**
 * Peer registry.
 * Stores mediasoup state + social graph state.
 * Updated per scalable SFU architecture doc.
 */

const peerMap = new Map();

const peers = {
  set: (socketId, info) => {
    peerMap.set(socketId, {
      ...info,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      // Social graph state
      connectedPeers: new Set(),
      visiblePeers: new Set(),
      peerScores: new Map(),
      // Limits per architecture doc
      maxVideoPeers: 9,
      maxAudioPeers: 50,
      isSpeaking: false,
      joinedAt: Date.now(),
    });
  },

  get: (socketId) => peerMap.get(socketId) || null,

  getAll: () => Array.from(peerMap.values()),

  delete: (socketId) => {
    const peer = peerMap.get(socketId);
    if (peer) {
      // Close all mediasoup transports
      for (const transport of peer.transports.values()) {
        try { transport.close(); } catch (_) {}
      }
      // Close all producers
      for (const producer of peer.producers.values()) {
        try { producer.close(); } catch (_) {}
      }
      // Close all consumers
      for (const consumer of peer.consumers.values()) {
        const item = typeof consumer === 'object' && consumer.consumer
          ? consumer.consumer
          : consumer;
        try { item.close(); } catch (_) {}
      }
    }
    peerMap.delete(socketId);
  },

  findByPeerId: (peerId) => {
    for (const [socketId, peer] of peerMap.entries()) {
      if (peer.peerId === peerId) return { socketId, ...peer };
    }
    return null;
  },

  findByUserId: (userId) => {
    for (const [socketId, peer] of peerMap.entries()) {
      if (peer.userId?.toString() === userId?.toString()) return { socketId, ...peer };
    }
    return null;
  },

  addTransport: (socketId, transport) => {
    const peer = peerMap.get(socketId);
    if (peer) peer.transports.set(transport.id, transport);
  },

  addProducer: (socketId, producer) => {
    const peer = peerMap.get(socketId);
    if (peer) peer.producers.set(producer.id, producer);
  },

  addConsumer: (socketId, consumer, producerPeerId) => {
    const peer = peerMap.get(socketId);
    if (!peer) return;
    peer.consumers.set(consumer.id, {
      consumer,
      producerPeerId,
      paused: false,
    });
    peer.connectedPeers.add(producerPeerId);
  },

  removeConnectedPeer: (socketId, peerId) => {
    const peer = peerMap.get(socketId);
    if (!peer) return;
    peer.connectedPeers.delete(peerId);
  },

  /**
   * Check if this peer can consume more video streams
   * (capped at maxVideoPeers per the architecture limits)
   */
  canConsumeMore: (socketId) => {
    const peer = peerMap.get(socketId);
    if (!peer) return false;
    return peer.connectedPeers.size < peer.maxVideoPeers;
  },

  setPeerScore: (socketId, peerId, score) => {
    const peer = peerMap.get(socketId);
    if (!peer) return;
    peer.peerScores.set(peerId, score);
  },

  getPeerScore: (socketId, peerId) => {
    const peer = peerMap.get(socketId);
    if (!peer) return 0;
    return peer.peerScores.get(peerId) || 0;
  },

  setVisiblePeers: (socketId, peerIds) => {
    const peer = peerMap.get(socketId);
    if (!peer) return;
    peer.visiblePeers = new Set(peerIds);
  },

  setSpeaking: (socketId, isSpeaking) => {
    const peer = peerMap.get(socketId);
    if (peer) peer.isSpeaking = isSpeaking;
  },

  count: () => peerMap.size,
};

module.exports = peers;