const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const mediasoupManager = require('./mediasoup');
const peers = require('./peers');
const rooms = require('./rooms');

function initSignaling(server) {

    const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:3000';

    const io = new Server(server, {
        cors: {
            origin: allowedOrigin,
            methods: ['GET', 'POST']
        }
    });

    // ── JWT Authentication middleware ─────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {

        console.log('[socket] connected', socket.id);

        // =====================================================
        // JOIN ROOM
        // =====================================================

        socket.on('joinRoom', async ({ roomId, userId, username }, callback) => {

            try {

                socket.join(roomId);

                peers.set(socket.id, {
                    socketId: socket.id,
                    roomId,
                    userId,
                    username
                });

                rooms.addPeer(roomId, {
                    socketId: socket.id,
                    roomId,
                    userId,
                    username
                });

                const routerRtpCapabilities =
                    await mediasoupManager.getRouterRtpCapabilities(roomId);

                callback({
                    rtpCapabilities: routerRtpCapabilities
                });

                console.log(`[room] ${socket.id} joined ${roomId}`);

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // GET RTP CAPABILITIES
        // =====================================================

        socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {

            try {

                const rtpCapabilities =
                    await mediasoupManager.getRouterRtpCapabilities(roomId);

                callback(rtpCapabilities);

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // CREATE TRANSPORT
        // =====================================================

        socket.on('createWebRtcTransport', async ({ roomId, consumer }, callback) => {

            try {

                const { transport, params } =
                    await mediasoupManager.createWebRtcTransport(roomId);

                // Set appData BEFORE registering so peers.addTransport stores
                // the reference with the correct flag already in place.
                transport.appData = { consumer };

                peers.addTransport(socket.id, transport);

                callback({
                    params
                });

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // CONNECT TRANSPORT
        // =====================================================

        socket.on('connectTransport', async ({
            transportId,
            dtlsParameters
        }, callback) => {

            try {

                const peer = peers.get(socket.id);
                if (!peer) return callback({ error: 'Peer not found' });

                const transport =
                    peer.transports.get(transportId);

                if (!transport) return callback({ error: 'Transport not found' });

                await transport.connect({
                    dtlsParameters
                });

                callback({
                    connected: true
                });

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // PRODUCE
        // =====================================================

        socket.on('produce', async ({
            transportId,
            kind,
            rtpParameters,
            roomId
        }, callback) => {

            try {

                const peer = peers.get(socket.id);
                if (!peer) return callback({ error: 'Peer not found' });

                const transport =
                    peer.transports.get(transportId);

                if (!transport) return callback({ error: 'Transport not found' });

                const producer =
                    await transport.produce({
                        kind,
                        rtpParameters
                    });

                peers.addProducer(socket.id, producer);

                producer.on('transportclose', () => {
                    producer.close();
                });

                const peerInfo = peers.get(socket.id);
                socket.to(roomId).emit('newProducer', {
                  producerId: producer.id,
                  kind:       producer.kind,
                  socketId:   socket.id,
                  userId:     peerInfo?.userId,
                  username:   peerInfo?.username,
                });

                console.log(`[producer] ${producer.id}`);

                callback({
                    id: producer.id
                });

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // GET PRODUCERS
        // =====================================================

        socket.on('getProducers', ({ roomId }, callback) => {

            try {

                const producerList =
                    rooms.getProducersInRoom(
                        roomId,
                        socket.id,
                        peers
                    );

                callback(
                    producerList.map(p => ({
                        producerId: p.producerId,
                        kind:       p.kind,
                        socketId:   p.socketId,
                        userId:     p.userId,
                        username:   p.username,
                    }))
                );

            } catch (err) {

                console.error(err);

                callback([]);
            }
        });

        // =====================================================
        // CONSUME
        // =====================================================

        socket.on('consume', async ({
            roomId,
            producerId,
            rtpCapabilities
        }, callback) => {

            try {

                const peer = peers.get(socket.id);

                const canConsume =
                    await mediasoupManager.canConsume(
                        roomId,
                        producerId,
                        rtpCapabilities
                    );

                if (!canConsume) {

                    return callback({
                        error: 'cannot consume'
                    });
                }

                const transport =
                    [...peer.transports.values()]
                        .find(t => t.appData.consumer);

                if (!transport) {

                    return callback({
                        error: 'consumer transport not found'
                    });
                }

                const consumer =
                    await transport.consume({
                        producerId,
                        rtpCapabilities,
                        paused: true
                    });

                peers.addConsumer(
                    socket.id,
                    consumer
                );

                consumer.on('transportclose', () => {
                    consumer.close();
                });

                consumer.on('producerclose', () => {

                    consumer.close();

                    socket.emit('producerClosed', {
                        producerId
                    });
                });

                callback({
                    id: consumer.id,
                    producerId,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters
                });

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // RESUME CONSUMER
        // =====================================================

        socket.on('resumeConsumer', async ({
            consumerId
        }, callback) => {

            try {

                const peer = peers.get(socket.id);

                const consumerData =
                    peer.consumers.get(consumerId);

                const consumer =
                    consumerData.consumer || consumerData;

                await consumer.resume();

                callback({
                    resumed: true
                });

            } catch (err) {

                console.error(err);

                callback({
                    error: err.message
                });
            }
        });

        // =====================================================
        // DISCONNECT
        // =====================================================

        socket.on('disconnect', () => {

            console.log('[socket] disconnected', socket.id);

            const peer = peers.get(socket.id);

            if (peer) {

                socket.to(peer.roomId).emit('peer_left', {
                    socketId: socket.id,
                    userId:   peer.userId,
                    username: peer.username,
                });

                rooms.removePeer(
                    peer.roomId,
                    socket.id
                );

                peers.delete(socket.id);
            }
        });
    });
}

module.exports = {
    initSignaling
};