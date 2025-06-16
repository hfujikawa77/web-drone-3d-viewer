const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('.'));

// UDP client for MAVLink
const udpClient = dgram.createSocket('udp4');
const MAVLINK_PORT = 14551;

// MAVLink message IDs
const MAVLINK_MSG_ID_HEARTBEAT = 0;
const MAVLINK_MSG_ID_ATTITUDE = 30;
const MAVLINK_MSG_ID_GLOBAL_POSITION_INT = 33;

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

// Parse MAVLink ATTITUDE message (simplified)
function parseAttitude(buffer, offset) {
    // Check MAVLink version
    const isV2 = buffer[offset] === 0xFD;
    // MAVLink v1 header is 6 bytes, v2 header is 10 bytes
    const payloadStart = offset + (isV2 ? 10 : 6);
    
    // Check if we have enough buffer length
    if (payloadStart + 28 > buffer.length) {
        return null;
    }
    
    // ATTITUDE message payload:
    // time_boot_ms (0-3): uint32
    // roll (4-7): float
    // pitch (8-11): float
    // yaw (12-15): float
    // rollspeed (16-19): float
    // pitchspeed (20-23): float
    // yawspeed (24-27): float
    
    const roll = buffer.readFloatLE(payloadStart + 4);
    const pitch = buffer.readFloatLE(payloadStart + 8);
    const yaw = buffer.readFloatLE(payloadStart + 12);
    
    return {
        roll: roll * 180 / Math.PI,
        pitch: pitch * 180 / Math.PI,
        yaw: yaw * 180 / Math.PI
    };
}

// Parse MAVLink GLOBAL_POSITION_INT message
function parseGlobalPosition(buffer, offset) {
    // Check MAVLink version
    const isV2 = buffer[offset] === 0xFD;
    // MAVLink v1 header is 6 bytes, v2 header is 10 bytes
    const payloadStart = offset + (isV2 ? 10 : 6);
    
    // Check if we have enough buffer length
    if (payloadStart + 28 > buffer.length) {
        return null;
    }
    
    // GLOBAL_POSITION_INT message payload:
    // time_boot_ms (0-3): uint32
    // lat (4-7): int32
    // lon (8-11): int32
    // alt (12-15): int32
    // relative_alt (16-19): int32
    
    const lat = buffer.readInt32LE(payloadStart + 4) / 1e7;
    const lon = buffer.readInt32LE(payloadStart + 8) / 1e7;
    const alt = buffer.readInt32LE(payloadStart + 12) / 1000; // mm to m
    const relative_alt = buffer.readInt32LE(payloadStart + 16) / 1000;
    
    return {
        lat,
        lon,
        alt,
        relative_alt
    };
}

// Listen for MAVLink messages
udpClient.on('message', (msg) => {
    // MAVLink parser (v1.0 and v2.0)
    for (let i = 0; i < msg.length - 8; i++) {
        if (msg[i] === 0xFE || msg[i] === 0xFD) { // MAVLink v1.0 (0xFE) or v2.0 (0xFD)
            let msgId;
            
            if (msg[i] === 0xFD) {
                // MAVLink v2.0: message ID is at offset 7-9 (24-bit)
                msgId = msg[i + 7]; // Using only first byte for common messages
            } else {
                // MAVLink v1.0: message ID is at offset 5
                msgId = msg[i + 5];
            }
            
            let data = null;
            
            switch (msgId) {
                case MAVLINK_MSG_ID_ATTITUDE:
                    const attitude = parseAttitude(msg, i);
                    if (attitude) {
                        data = {
                            type: 'attitude',
                            ...attitude
                        };
                    }
                    break;
                    
                case MAVLINK_MSG_ID_GLOBAL_POSITION_INT:
                    const position = parseGlobalPosition(msg, i);
                    if (position) {
                        data = {
                            type: 'position',
                            ...position
                        };
                    }
                    break;
            }
            
            if (data) {
                // Send to all connected clients
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        }
    }
});

// Bind to UDP port
udpClient.bind(MAVLINK_PORT, () => {
    console.log(`Listening for MAVLink on UDP port ${MAVLINK_PORT}`);
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/web-viewer.html in your browser`);
});