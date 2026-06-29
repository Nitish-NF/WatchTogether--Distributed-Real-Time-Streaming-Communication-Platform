/**
 * mediasoupClient.js
 * Client-side helpers for the mediasoup WebRTC signalling flow.
 */

import { webrtcSocket } from '../sockets/webrtcSocket.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function emitAsync(event, payload) {
  return new Promise((resolve) => webrtcSocket.emit(event, payload, resolve));
}

// ── send transport ────────────────────────────────────────────────────────────

export async function createSendTransport(device, roomId) {
  const data = await emitAsync('createWebRtcTransport', { roomId, consumer: false });
  if (data?.error) throw new Error(`createWebRtcTransport (send): ${data.error}`);

  const transport = device.createSendTransport(data.params);

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    emitAsync('connectTransport', { transportId: transport.id, dtlsParameters })
      .then(res => (res?.error ? errback(new Error(res.error)) : callback()))
      .catch(errback);
  });

  transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
    emitAsync('produce', { transportId: transport.id, kind, rtpParameters, appData, roomId })
      .then(res => (res?.error ? errback(new Error(res.error)) : callback({ id: res.id })))
      .catch(errback);
  });

  transport.on('connectionstatechange', (state) => {
    console.log('[mediasoupClient] send transport state:', state);
  });

  return transport;
}

// ── recv transport ────────────────────────────────────────────────────────────

export async function createRecvTransport(device, roomId) {
  const data = await emitAsync('createWebRtcTransport', { roomId, consumer: true });
  if (data?.error) throw new Error(`createWebRtcTransport (recv): ${data.error}`);

  const transport = device.createRecvTransport(data.params);

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    emitAsync('connectTransport', { transportId: transport.id, dtlsParameters })
      .then(res => (res?.error ? errback(new Error(res.error)) : callback()))
      .catch(errback);
  });

  transport.on('connectionstatechange', (state) => {
    console.log('[mediasoupClient] recv transport state:', state);
  });

  return transport;
}

// ── produce local media ───────────────────────────────────────────────────────

export async function startProducing(transport, device, stream) {
  const producers = { video: null, audio: null };
  if (!stream) return producers;

  const tasks = [];

  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack && device.canProduce('video')) {
    tasks.push(
      transport
        .produce({ track: videoTrack, appData: { kind: 'video' } })
        .then(p  => { producers.video = p; console.log('[mediasoupClient] video producer ready'); })
        .catch(err => console.error('[mediasoupClient] video produce error:', err))
    );
  }

  const audioTrack = stream.getAudioTracks()[0];
  if (audioTrack && device.canProduce('audio')) {
    tasks.push(
      transport
        .produce({ track: audioTrack, appData: { kind: 'audio' } })
        .then(p  => { producers.audio = p; console.log('[mediasoupClient] audio producer ready'); })
        .catch(err => console.error('[mediasoupClient] audio produce error:', err))
    );
  }

  await Promise.all(tasks);
  return producers;
}

// ── consume a remote producer ─────────────────────────────────────────────────

export async function consumeFromPeer({
  producerId,
  peerSocketId,
  peerUsername,
  roomId,
  device,
  recvTransport,
}) {
  // FIX 2: pass transportId explicitly so the server looks it up by ID
  // instead of using the fragile .find(t => t.appData.consumer) search
  const data = await emitAsync('consume', {
    roomId,
    producerId,
    transportId:     recvTransport.id,   // ← KEY FIX
    rtpCapabilities: device.rtpCapabilities,
  });

  if (data?.error) {
    console.error('[mediasoupClient] consume error:', data.error);
    return null;
  }

  if (!data?.id || !data?.rtpParameters) {
    console.error('[mediasoupClient] consume: bad server response', data);
    return null;
  }

  const consumer = await recvTransport.consume({
    id:            data.id,
    producerId:    data.producerId,
    kind:          data.kind,
    rtpParameters: data.rtpParameters,
  });

  // Resume immediately — server pauses consumers by default
  await emitAsync('resumeConsumer', { consumerId: consumer.id });

  consumer.on('transportclose', () =>
    console.log('[mediasoupClient] consumer transport closed:', consumer.id)
  );
  consumer.on('trackended', () =>
    console.log('[mediasoupClient] remote track ended:', consumer.id)
  );

  console.log(`[mediasoupClient] consuming ${data.kind} from ${peerUsername} (${peerSocketId})`);

  return {
    consumer,
    track:        consumer.track,
    peerKey:      peerSocketId || producerId,
    peerUsername: peerUsername || 'Guest',
  };
}