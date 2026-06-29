const mediasoup = require('mediasoup');
const os = require('os');

/**
 * mediasoup SFU manager.
 * Creates one Worker per CPU core (max 4) and round-robins routers.
 * Updated per scalable SFU architecture doc.
 */

const config = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  },
  webRtcTransport: {
    // NOTE: listenIps (v3) kept for reference only.
    // createWebRtcTransport() uses listenInfos (v4 API) inline with env vars.
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
};

let workers = [];
let nextWorkerIndex = 0;
// roomId → mediasoup Router
const routers = new Map();

const mediasoupManager = {
  initSignaling: async () => {
    const numWorkers = Math.min(os.cpus().length, 4);
    // Close any existing workers before re-creating (e.g. after crash restart)
    for (const w of workers) {
      try { w.close(); } catch (_) {}
    }
    workers = [];
    nextWorkerIndex = 0;

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(config.worker);
      worker.on('died', () => {
        console.error(`[mediasoup] Worker ${worker.pid} died — restarting in 2s`);
        setTimeout(() => mediasoupManager.initSignaling(), 2000);
      });
      workers.push(worker);
      console.log(`[mediasoup] Worker ${worker.pid} created`);
    }
  },

  getWorker: () => {
    if (workers.length === 0) throw new Error('mediasoup not initialized');
    const worker = workers[nextWorkerIndex % workers.length];
    nextWorkerIndex++;
    return worker;
  },

  getOrCreateRouter: async (roomId) => {
    if (routers.has(roomId)) return routers.get(roomId);
    const worker = mediasoupManager.getWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });
    routers.set(roomId, router);
    console.log(`[mediasoup] Router created for room ${roomId}`);
    return router;
  },

  /**
   * Returns router RTP capabilities — the client needs this before
   * creating a device and transports.
   */
  getRouterRtpCapabilities: async (roomId) => {
    const router = await mediasoupManager.getOrCreateRouter(roomId);
    return router.rtpCapabilities;
  },

  closeRouter: (roomId) => {
    const router = routers.get(roomId);
    if (router) {
      router.close();
      routers.delete(roomId);
      console.log(`[mediasoup] Router closed for room ${roomId}`);
    }
  },

  /**
   * Creates a WebRTC transport (both send and receive share the same API).
   * Returns { transport, params } where params is sent to the client.
   */
createWebRtcTransport: async (roomId) => {

    const router =
        await mediasoupManager.getOrCreateRouter(roomId);

    const transport =
        await router.createWebRtcTransport({

            listenInfos: [
                {
                    protocol: 'udp',

                    ip:
                        process.env.MEDIASOUP_LISTEN_IP ||
                        '0.0.0.0',

                    announcedAddress:
                        process.env.MEDIASOUP_ANNOUNCED_IP ||
                        '127.0.0.1',
                },

                {
                    protocol: 'tcp',

                    ip:
                        process.env.MEDIASOUP_LISTEN_IP ||
                        '0.0.0.0',

                    announcedAddress:
                        process.env.MEDIASOUP_ANNOUNCED_IP ||
                        '127.0.0.1',
                }
            ],

            enableUdp: true,

            enableTcp: true,

            preferUdp: true,

            initialAvailableOutgoingBitrate: 1000000,
        });

    console.log(
        '[mediasoup] transport created',
        transport.id
    );

    transport.on(
        'dtlsstatechange',

        (state) => {

            console.log(
                '[transport dtls]',
                transport.id,
                state
            );

            if (state === 'closed') {

                transport.close();
            }
        }
    );

    transport.on(
        'icestatechange',

        (state) => {

            console.log(
                '[transport ice]',
                transport.id,
                state
            );
        }
    );

    return {

        transport,

        params: {

            id:
                transport.id,

            iceParameters:
                transport.iceParameters,

            iceCandidates:
                transport.iceCandidates,

            dtlsParameters:
                transport.dtlsParameters,
        }
    };
},

  /**
   * Check whether a router can consume a given producer with the
   * provided RTP capabilities.
   */
  canConsume: async (roomId, producerId, rtpCapabilities) => {
    const router = await mediasoupManager.getOrCreateRouter(roomId);
    return router.canConsume({ producerId, rtpCapabilities });
  },

  /** Returns the number of active mediasoup workers. */
  workerCount: () => workers.length,

  config,
};

module.exports = mediasoupManager;